/**
 * ============================================
 * SERVICIO: EscuelasService
 * ============================================
 * 
 * Servicio que maneja las operaciones CRUD de escuelas.
 * Solo los administradores pueden gestionar escuelas.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Director } from '../personas/entities/director.entity';
import { EscuelaLibro } from './entities/escuela-libro.entity';
import { Libro } from '../libros/entities/libro.entity';
import { Segmento } from '../libros/entities/segmento.entity';
import { AlumnoLibro } from './entities/alumno-libro.entity';
import { MaestroGrupo } from './entities/maestro-grupo.entity';
import { Anotacion } from './entities/anotacion.entity';
import { AlumnoMaestro } from '../personas/entities/alumno-maestro.entity';
import { alumnoPerteneceAGrupos, grupoCoincide } from '../common/utils/grupo.utils';
import { LicenciasService } from '../licencias/licencias.service';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { AuditService } from '../audit/audit.service';
import { CrearAnotacionDto } from './dto/crear-anotacion.dto';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

export interface DesasignarLibroContext {
  /** Director: solo permite si alumno.escuelaId === escuelaIdRestriccion */
  escuelaIdRestriccion?: number;
  /** Maestro: solo permite si alumno está en Alumno_Maestro O en grupos del maestro */
  maestroId?: number;
  /** Contexto para auditoría (usuarioId, ip) */
  auditContext?: AuditContext;
}

@Injectable()
export class EscuelasService {
  private readonly logger = new Logger(EscuelasService.name);

  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepository: Repository<EscuelaLibro>,
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(Anotacion)
    private readonly anotacionRepository: Repository<Anotacion>,
    @InjectRepository(MaestroGrupo)
    private readonly maestroGrupoRepository: Repository<MaestroGrupo>,
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly licenciasService: LicenciasService,
  ) {}

  /**
   * Crear una nueva escuela
   */
  async crear(crearEscuelaDto: CrearEscuelaDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de creación de escuela: ${crearEscuelaDto.nombre}`);

    // Verificar si ya existe una escuela con el mismo nombre
    const escuelaExistente = await this.escuelaRepository.findOne({
      where: { nombre: crearEscuelaDto.nombre },
    });

    if (escuelaExistente) {
      this.logger.warn(`Creación fallida: Escuela con nombre duplicado - ${crearEscuelaDto.nombre}`);
      throw new ConflictException('Ya existe una escuela con ese nombre');
    }

    // Si se proporciona clave, verificar que no esté duplicada
    if (crearEscuelaDto.clave) {
      const escuelaConClave = await this.escuelaRepository.findOne({
        where: { clave: crearEscuelaDto.clave },
      });

      if (escuelaConClave) {
        this.logger.warn(`Creación fallida: Escuela con clave duplicada - ${crearEscuelaDto.clave}`);
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    // Crear la escuela
    const escuela = this.escuelaRepository.create({
      nombre: crearEscuelaDto.nombre,
      nivel: crearEscuelaDto.nivel,
      clave: crearEscuelaDto.clave || null,
      direccion: crearEscuelaDto.direccion || null,
      telefono: crearEscuelaDto.telefono || null,
      estado: crearEscuelaDto.estado || 'activa',
      ciudad: crearEscuelaDto.ciudad || null,
      estadoRegion: crearEscuelaDto.estadoRegion || null,
    });

    const escuelaGuardada = await this.escuelaRepository.save(escuela);

    this.logger.log(`Escuela creada exitosamente: ${escuelaGuardada.nombre} - ID: ${escuelaGuardada.id}`);

    await this.auditService.log('escuela_crear', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${escuelaGuardada.nombre} (id: ${escuelaGuardada.id})`,
    });

    return {
      message: 'Escuela creada exitosamente',
      description: 'La escuela ha sido registrada correctamente en el sistema.',
      data: escuelaGuardada,
    };
  }

  /**
   * Lista mínima para dropdowns de registro (público).
   * Solo escuelas activas: { id, nombre }.
   */
  async listarParaRegistro() {
    const escuelas = await this.escuelaRepository.find({
      where: { estado: 'activa' },
      select: ['id', 'nombre'],
      order: { nombre: 'ASC' },
    });
    return {
      message: 'Lista de escuelas',
      data: escuelas.map((e) => ({ id: e.id, nombre: e.nombre })),
    };
  }

  /**
   * Obtener todas las escuelas con director(es), alumnos, profesores y grupos.
   */
  async obtenerTodas(page?: number, limit?: number) {
    const qb = this.escuelaRepository
      .createQueryBuilder('escuela')
      .orderBy('escuela.nombre', 'ASC');

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const escuelas = await qb.getMany();
    const escuelaIds = escuelas.map((e) => e.id);

    if (escuelaIds.length === 0) {
      const meta =
        page != null && limit != null
          ? { page, limit, total, totalPages: Math.ceil(total / limit) }
          : undefined;
      return {
        message: 'Escuelas obtenidas exitosamente',
        description: 'Se encontraron 0 escuela(s) en el sistema',
        total,
        ...(meta && { meta }),
        data: [],
      };
    }

    const [directores, conteoAlumnos, conteoMaestros, conteoGrupos] = await Promise.all([
      this.directorRepository.find({
        where: { escuelaId: In(escuelaIds), activo: true },
        relations: ['persona'],
      }),
      this.alumnoRepository
        .createQueryBuilder('a')
        .select('a.escuela_id', 'escuelaId')
        .addSelect('COUNT(*)', 'total')
        .where('a.escuela_id IN (:...ids)', { ids: escuelaIds })
        .andWhere('a.activo = true')
        .groupBy('a.escuela_id')
        .getRawMany(),
      this.maestroRepository
        .createQueryBuilder('m')
        .select('m.escuela_id', 'escuelaId')
        .addSelect('COUNT(*)', 'total')
        .where('m.escuela_id IN (:...ids)', { ids: escuelaIds })
        .groupBy('m.escuela_id')
        .getRawMany(),
      this.dataSource
        .createQueryBuilder()
        .select('a.escuela_id', 'escuelaId')
        .addSelect('COUNT(DISTINCT (a.grado::text || \'-\' || COALESCE(a.grupo, \'\')))', 'total')
        .from(Alumno, 'a')
        .where('a.escuela_id IN (:...ids)', { ids: escuelaIds })
        .andWhere('a.activo = true')
        .groupBy('a.escuela_id')
        .getRawMany(),
    ]);

    const mapDirectores = new Map<number, string[]>();
    for (const d of directores) {
      const list = mapDirectores.get(Number(d.escuelaId)) ?? [];
      const nombreCompleto = [d.persona?.nombre, d.persona?.apellidoPaterno, d.persona?.apellidoMaterno].filter(Boolean).join(' ');
      list.push(nombreCompleto || '—');
      mapDirectores.set(Number(d.escuelaId), list);
    }

    const mapAlumnos = new Map<number, number>();
    for (const r of conteoAlumnos) {
      mapAlumnos.set(Number(r.escuelaId), Number(r.total));
    }
    const mapMaestros = new Map<number, number>();
    for (const r of conteoMaestros) {
      mapMaestros.set(Number(r.escuelaId), Number(r.total));
    }
    const mapGrupos = new Map<number, number>();
    for (const r of conteoGrupos) {
      mapGrupos.set(Number(r.escuelaId), Number(r.total));
    }

    const data = escuelas.map((e) => {
      const id = Number(e.id);
      return {
        ...e,
        directores: mapDirectores.get(id) ?? [],
        alumnosRegistrados: mapAlumnos.get(id) ?? 0,
        profesores: mapMaestros.get(id) ?? 0,
        grupos: mapGrupos.get(id) ?? 0,
      };
    });

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    this.logger.log(`Consulta de escuelas: ${escuelas.length} encontradas`);

    return {
      message: 'Escuelas obtenidas exitosamente',
      description: `Se encontraron ${escuelas.length} escuela(s) en el sistema`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /**
   * Estadísticas del panel de gestión de escuelas (tarjetas del dashboard).
   * Total escuelas, activas, alumnos, profesores y licencias.
   */
  async obtenerEstadisticasPanel() {
    const [totalEscuelas, escuelasActivas, totalAlumnos, totalProfesores, librosListos] =
      await Promise.all([
        this.escuelaRepository.count(),
        this.escuelaRepository.count({ where: { estado: 'activa' } }),
        this.alumnoRepository.count(),
        this.maestroRepository.count(),
        this.libroRepository.count({ where: { estado: 'listo' } }),
      ]);

    return {
      message: 'Estadísticas del panel de escuelas obtenidas correctamente',
      data: {
        totalEscuelas,
        escuelasActivas,
        totalAlumnos,
        totalProfesores,
        licencias: librosListos, // licencias disponibles (libros listos); puede reemplazarse por un valor de configuración
      },
    };
  }

  /**
   * Obtener una escuela por ID (para ver detalle o cargar formulario de edición).
   * Incluye directores con persona y estadísticas (alumnos, profesores, grupos).
   */
  async obtenerPorId(id: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id },
      relations: ['directores', 'directores.persona'],
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    const [totalAlumnos, totalMaestros, totalGrupos] = await Promise.all([
      this.alumnoRepository.count({ where: { escuelaId: id } }),
      this.maestroRepository.count({ where: { escuelaId: id } }),
      this.alumnoRepository
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT CONCAT(COALESCE(a.grado::text, \'\'), \'-\', COALESCE(a.grupo, \'\')))', 'count')
        .where('a.escuelaId = :id', { id })
        .getRawOne()
        .then((r) => (r?.count ? Number(r.count) : 0)),
    ]);

    const directores = (escuela.directores || []).map((d) => ({
      id: d.id,
      personaId: d.personaId,
      persona: d.persona
        ? {
            id: d.persona.id,
            nombre: d.persona.nombre,
            apellidoPaterno: d.persona.apellidoPaterno,
            apellidoMaterno: d.persona.apellidoMaterno ?? null,
            correo: d.persona.correo,
            telefono: d.persona.telefono,
            genero: d.persona.genero ?? null,
          }
        : null,
    }));

    const data = {
      ...escuela,
      directores,
      estadisticas: {
        alumnos: totalAlumnos,
        profesores: totalMaestros,
        grupos: totalGrupos,
      },
    };

    return {
      message: 'Escuela obtenida exitosamente',
      description: 'La escuela fue encontrada en el sistema',
      data,
    };
  }

  /**
   * Actualizar una escuela
   */
  async actualizar(id: number, actualizarEscuelaDto: ActualizarEscuelaDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de actualización de escuela ID: ${id}`);

    const escuela = await this.escuelaRepository.findOne({
      where: { id },
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    // Verificar si el nuevo nombre ya existe (si se está cambiando)
    if (actualizarEscuelaDto.nombre && actualizarEscuelaDto.nombre !== escuela.nombre) {
      const escuelaConNombre = await this.escuelaRepository.findOne({
        where: { nombre: actualizarEscuelaDto.nombre },
      });

      if (escuelaConNombre) {
        throw new ConflictException('Ya existe una escuela con ese nombre');
      }
    }

    // Verificar si la nueva clave ya existe (si se está cambiando)
    if (actualizarEscuelaDto.clave && actualizarEscuelaDto.clave !== escuela.clave) {
      const escuelaConClave = await this.escuelaRepository.findOne({
        where: { clave: actualizarEscuelaDto.clave },
      });

      if (escuelaConClave) {
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    // Actualizar los campos
    const estadoAnterior = escuela.estado ?? 'activa';
    Object.assign(escuela, actualizarEscuelaDto);

    const escuelaActualizada = await this.escuelaRepository.save(escuela);
    const estadoNuevo = escuelaActualizada.estado ?? 'activa';

    // Cascada: al pasar escuela a inactiva/suspendida se desactivan alumnos, maestros, directores y libros.
    // Al pasar a activa se reactivan todos.
    const esInactiva = estadoNuevo === 'inactiva' || estadoNuevo === 'suspendida';
    const activoValor = esInactiva ? false : true;
    if (estadoAnterior !== estadoNuevo) {
      await this.alumnoRepository.update({ escuelaId: id }, { activo: activoValor });
      await this.maestroRepository.update({ escuelaId: id }, { activo: activoValor });
      await this.directorRepository.update({ escuelaId: id }, { activo: activoValor });
      await this.escuelaLibroRepository.update({ escuelaId: id }, { activo: activoValor });
      this.logger.log(
        `Escuela ID ${id}: cascada ${esInactiva ? 'desactivación' : 'reactivación'} aplicada (alumnos, maestros, directores, libros).`,
      );
    }

    this.logger.log(`Escuela actualizada exitosamente: ${escuelaActualizada.nombre} - ID: ${escuelaActualizada.id}`);

    await this.auditService.log('escuela_actualizar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `id: ${id} | ${escuelaActualizada.nombre} | estado: ${estadoNuevo}`,
    });

    return {
      message: 'Escuela actualizada exitosamente',
      description: 'La información de la escuela ha sido actualizada correctamente.',
      data: escuelaActualizada,
    };
  }

  /**
   * Eliminar una escuela
   */
  async eliminar(id: number, auditContext?: AuditContext) {
    this.logger.log(`Intento de eliminación de escuela ID: ${id}`);

    const escuela = await this.escuelaRepository.findOne({
      where: { id },
      relations: ['alumnos', 'maestros'],
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    // Verificar si tiene alumnos o maestros asociados
    if (escuela.alumnos && escuela.alumnos.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la escuela porque tiene ${escuela.alumnos.length} alumno(s) asociado(s)`,
      );
    }

    if (escuela.maestros && escuela.maestros.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la escuela porque tiene ${escuela.maestros.length} maestro(s) asociado(s)`,
      );
    }

    await this.escuelaRepository.remove(escuela);

    this.logger.log(`Escuela eliminada exitosamente: ${escuela.nombre} - ID: ${id}`);

    await this.auditService.log('escuela_eliminar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${escuela.nombre} (id: ${id})`,
    });

    return {
      message: 'Escuela eliminada exitosamente',
      description: 'La escuela ha sido eliminada del sistema.',
    };
  }

  /**
   * Verificar si una escuela existe (método interno para otros servicios)
   */
  async existe(id: number): Promise<boolean> {
    const escuela = await this.escuelaRepository.findOne({
      where: { id },
    });
    return !!escuela;
  }

  /**
   * Obtener una escuela sin relaciones (método interno)
   */
  async obtenerUna(id: number): Promise<Escuela | null> {
    return await this.escuelaRepository.findOne({
      where: { id },
    });
  }

  /**
   * Listar directores activos de una escuela.
   */
  async listarDirectoresDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const directoresEntidad = await this.directorRepository.find({
      where: { escuelaId, activo: true },
      relations: ['persona'],
    });
    const directores = directoresEntidad.map((d) => ({
      id: d.id,
      personaId: d.personaId,
      escuelaId: d.escuelaId,
      fechaNombramiento: d.fechaNombramiento,
      persona: d.persona
        ? {
            id: d.persona.id,
            nombre: d.persona.nombre,
            apellidoPaterno: d.persona.apellidoPaterno,
            apellidoMaterno: d.persona.apellidoMaterno ?? null,
            correo: d.persona.correo,
            telefono: d.persona.telefono,
            genero: d.persona.genero ?? null,
          }
        : null,
    }));
    return {
      message: 'Directores de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${directores.length} director(es).`,
      total: directores.length,
      data: directores,
    };
  }

  /**
   * Listar todos los directores activos del sistema con datos de su escuela (solo admin).
   */
  async listarTodosLosDirectores(page?: number, limit?: number) {
    const qb = this.escuelaRepository
      .createQueryBuilder('escuela')
      .leftJoinAndSelect('escuela.directores', 'director', 'director.activo = :activo', { activo: true })
      .leftJoinAndSelect('director.persona', 'persona')
      .orderBy('escuela.nombre', 'ASC')
      .addOrderBy('director.id', 'ASC');

    const escuelas = await qb.getMany();
    const directores: Array<{
      id: number;
      personaId: number;
      escuelaId: number;
      fechaNombramiento: Date | null;
      persona: {
        id: number;
        nombre: string;
        apellidoPaterno: string;
        apellidoMaterno: string | null;
        correo: string;
        telefono: string | null;
        genero: string | null;
      } | null;
      escuela: { id: number; nombre: string; nivel: string; clave: string | null };
    }> = [];

    for (const e of escuelas) {
      for (const d of e.directores || []) {
        directores.push({
          id: d.id,
          personaId: d.personaId,
          escuelaId: d.escuelaId,
          fechaNombramiento: d.fechaNombramiento ?? null,
          persona: d.persona
            ? {
                id: d.persona.id,
                nombre: d.persona.nombre,
                apellidoPaterno: d.persona.apellidoPaterno,
                apellidoMaterno: d.persona.apellidoMaterno ?? null,
                correo: d.persona.correo,
                telefono: d.persona.telefono ?? null,
                genero: d.persona.genero ?? null,
              }
            : null,
          escuela: {
            id: e.id,
            nombre: e.nombre,
            nivel: e.nivel,
            clave: e.clave ?? null,
          },
        });
      }
    }

    const total = directores.length;
    let data = directores;
    if (page != null && limit != null && page >= 1 && limit >= 1) {
      const start = (page - 1) * limit;
      data = directores.slice(start, start + limit);
    }

    this.logger.log(`Consulta de directores: ${total} encontrados`);

    const meta =
      page != null && limit != null && total > 0
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Directores obtenidos exitosamente.',
      description: `Se encontraron ${total} director(es) en el sistema.`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /**
   * Listar maestros activos de una escuela con sus grupos asignados.
   */
  async listarMaestrosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const maestrosEntidad = await this.maestroRepository.find({
      where: { escuelaId, activo: true },
      relations: ['persona'],
    });

    const maestroIds = maestrosEntidad.map((m) => m.id);
    const gruposPorMaestro = new Map<number, Array<{ id: number; grado: number; nombre: string; cantidadAlumnos: number }>>();
    const cantidadAlumnosPorGrupo = new Map<number, number>();

    if (maestroIds.length > 0) {
      const asignaciones = await this.maestroGrupoRepository.find({
        where: { maestroId: In(maestroIds) },
        relations: ['grupo'],
      });
      const grupoIds = [...new Set(asignaciones.map((a) => a.grupoId).filter(Boolean))];
      const gruposUnicos: Array<{ id: number; grado: number; nombre: string }> = [];
      for (const a of asignaciones) {
        if (!a.grupo || gruposUnicos.some((g) => g.id === a.grupo!.id)) continue;
        gruposUnicos.push({
          id: a.grupo.id,
          grado: Number(a.grupo.grado),
          nombre: a.grupo.nombre,
        });
      }

      if (grupoIds.length > 0) {
        const alumnosEnGrupos = await this.alumnoRepository.find({
          where: { escuelaId, activo: true },
          select: ['id', 'grupoId', 'grado', 'grupo'],
        });
        for (const g of gruposUnicos) {
          const count = alumnosEnGrupos.filter(
            (a) =>
              Number(a.grupoId) === Number(g.id) ||
              (a.grupoId == null && grupoCoincide(Number(a.grado), a.grupo, g.grado, g.nombre)),
          ).length;
          cantidadAlumnosPorGrupo.set(g.id, count);
        }
      }
      for (const a of asignaciones) {
        if (!a.grupo) continue;
        const cantidadAlumnos = cantidadAlumnosPorGrupo.get(a.grupo.id) ?? 0;
        const item = {
          id: a.grupo.id,
          grado: Number(a.grupo.grado),
          nombre: a.grupo.nombre,
          cantidadAlumnos,
        };
        const list = gruposPorMaestro.get(a.maestroId) ?? [];
        if (!list.some((g) => g.id === item.id)) list.push(item);
        gruposPorMaestro.set(a.maestroId, list);
      }
    }

    const maestros = maestrosEntidad.map((m) => {
      const grupos = gruposPorMaestro.get(m.id) ?? [];
      const cantidadGrupos = grupos.length;
      const cantidadAlumnos = grupos.reduce((sum, g) => sum + g.cantidadAlumnos, 0);
      return {
        id: m.id,
        personaId: m.personaId,
        escuelaId: m.escuelaId,
        especialidad: m.especialidad,
        fechaContratacion: m.fechaContratacion,
        persona: m.persona
          ? {
              id: m.persona.id,
              nombre: m.persona.nombre,
              apellidoPaterno: m.persona.apellidoPaterno,
              apellidoMaterno: m.persona.apellidoMaterno ?? null,
              correo: m.persona.correo,
              telefono: m.persona.telefono,
              genero: m.persona.genero ?? null,
            }
          : null,
        cantidadGrupos,
        cantidadAlumnos,
        grupos,
      };
    });
    return {
      message: 'Maestros de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${maestros.length} maestro(s).`,
      total: maestros.length,
      data: maestros,
    };
  }

  /**
   * Listar alumnos activos de una escuela.
   * Incluye persona y padre (si tiene) para ver de quién es hijo cada alumno.
   */
  async listarAlumnosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const alumnosEntidad = await this.alumnoRepository.find({
      where: { escuelaId, activo: true },
      relations: ['persona', 'padre', 'padre.persona'],
    });
    const alumnos = alumnosEntidad.map((a) => ({
      id: a.id,
      personaId: a.personaId,
      escuelaId: a.escuelaId,
      padreId: a.padreId ?? null,
      grado: a.grado,
      grupo: a.grupo,
      grupoId: a.grupoId ?? null,
      cicloEscolar: a.cicloEscolar,
      persona: a.persona
        ? {
            id: a.persona.id,
            nombre: a.persona.nombre,
            apellidoPaterno: a.persona.apellidoPaterno,
            apellidoMaterno: a.persona.apellidoMaterno ?? null,
            correo: a.persona.correo,
            telefono: a.persona.telefono,
            genero: a.persona.genero ?? null,
            fechaNacimiento: a.persona.fechaNacimiento != null
              ? (a.persona.fechaNacimiento instanceof Date
                  ? a.persona.fechaNacimiento.toISOString().split('T')[0]
                  : String(a.persona.fechaNacimiento).split('T')[0])
              : null,
          }
        : null,
      padre: a.padre
        ? {
            id: a.padre.id,
            parentesco: a.padre.parentesco,
            persona: a.padre.persona
              ? {
                  id: a.padre.persona.id,
                  nombre: a.padre.persona.nombre,
                  apellidoPaterno: a.padre.persona.apellidoPaterno,
                  apellidoMaterno: a.padre.persona.apellidoMaterno ?? null,
                  correo: a.padre.persona.correo,
                  telefono: a.padre.persona.telefono,
                  genero: a.padre.persona.genero ?? null,
                }
              : null,
          }
        : null,
    }));
    return {
      message: 'Alumnos de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${alumnos.length} alumno(s).`,
      total: alumnos.length,
      data: alumnos,
    };
  }

  /**
   * Activar o desactivar un libro solo para una escuela (Escuela_Libro.activo).
   */
  async setLibroActivoEnEscuela(escuelaId: number, libroId: number, activo: boolean) {
    const escuela = await this.escuelaRepository.findOne({ where: { id: escuelaId } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const el = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId },
      relations: ['libro'],
    });
    if (!el) {
      throw new NotFoundException(
        `El libro con ID ${libroId} no está asignado a la escuela con ID ${escuelaId}.`,
      );
    }
    el.activo = activo;
    await this.escuelaLibroRepository.save(el);
    this.logger.log(`Escuela ${escuelaId} / libro ${libroId}: activo=${activo}.`);
    return {
      message: activo ? 'Libro activado para esta escuela.' : 'Libro desactivado para esta escuela.',
      data: { escuelaId, libroId, activo, titulo: el.libro?.titulo },
    };
  }

  /**
   * Listar todas las escuelas con los libros que tiene cada una (admin).
   * Un mismo libro puede estar asignado a varias escuelas (cada asignación es independiente).
   */
  async listarEscuelasConLibros() {
    const asignaciones = await this.escuelaLibroRepository.find({
      relations: ['escuela', 'libro', 'libro.materia'],
      order: { escuelaId: 'ASC' },
    });
    const byEscuela = new Map<
      number,
      {
        escuelaId: number;
        nombreEscuela: string;
        ciudad: string | null;
        estadoRegion: string | null;
        estado: string;
        libros: Array<{
          escuelaLibroId: number;
          libroId: number;
          titulo: string;
          codigo: string;
          grado: number;
          materia: string | null;
          activoEnEscuela: boolean;
          activoGlobal: boolean;
          fechaInicio: Date;
          fechaFin: Date | null;
        }>;
      }
    >();
    for (const a of asignaciones) {
      if (!a.escuela) continue;
      if (!byEscuela.has(a.escuelaId)) {
        byEscuela.set(a.escuelaId, {
          escuelaId: a.escuela.id,
          nombreEscuela: a.escuela.nombre,
          ciudad: a.escuela.ciudad ?? null,
          estadoRegion: a.escuela.estadoRegion ?? null,
          estado: a.escuela.estado ?? 'activa',
          libros: [],
        });
      }
      const entry = byEscuela.get(a.escuelaId)!;
      entry.libros.push({
        escuelaLibroId: a.id,
        libroId: a.libroId,
        titulo: a.libro?.titulo ?? '',
        codigo: a.libro?.codigo ?? '',
        grado: a.libro?.grado ?? 0,
        materia: a.libro?.materia?.nombre ?? null,
        activoEnEscuela: a.activo,
        activoGlobal: a.libro?.activo !== false,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin ?? null,
      });
    }
    const data = Array.from(byEscuela.values()).sort((a, b) =>
      a.nombreEscuela.localeCompare(b.nombreEscuela),
    );
    return {
      message: 'Escuelas con sus libros obtenidas correctamente.',
      description: 'Cada escuela puede tener el mismo libro asignado; las asignaciones son independientes por escuela.',
      total: data.length,
      data,
    };
  }

  /**
   * Listar todas las asignaciones libro-escuela (activas e inactivas) para que el admin vea y pueda asignar/desasignar (toggle).
   * Incluye activo en esta escuela y activo global del libro.
   */
  async listarAsignacionesLibrosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const asignaciones = await this.escuelaLibroRepository.find({
      where: { escuelaId },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });
    const data = asignaciones.map((a) => ({
      escuelaLibroId: a.id,
      libroId: a.libroId,
      titulo: a.libro?.titulo,
      codigo: a.libro?.codigo,
      grado: a.libro?.grado,
      materia: a.libro?.materia?.nombre ?? null,
      activoEnEscuela: a.activo,
      activoGlobal: a.libro?.activo !== false,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
    }));
    return {
      message: 'Asignaciones de libros obtenidas correctamente.',
      description: `La escuela tiene ${data.length} libro(s) asignado(s). Usa PATCH .../libros/:libroId/activo para activar o desactivar.`,
      total: data.length,
      data,
    };
  }

  /**
   * Listar los libros asignados a una escuela (los que la escuela puede ver).
   * Solo libros con activo global (libro.activo) y asignación activa (Escuela_Libro.activo).
   */
  async listarLibrosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const asignaciones = await this.escuelaLibroRepository.find({
      where: { escuelaId, activo: true },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });

    const asignacionesActivas = asignaciones.filter((a) => a.libro?.activo !== false);

    const libros = asignacionesActivas.map((a) => ({
      ...a.libro,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      escuelaLibroId: a.id,
    }));

    return {
      message: 'Libros de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${libros.length} libro(s) asignado(s).`,
      total: libros.length,
      data: libros,
    };
  }

  /**
   * Listar libros asignados al alumno (Alternativa C: asignación explícita).
   * El alumno solo ve libros que maestro/director le asignó, con su progreso.
   */
  async listarLibrosAsignadosAlAlumno(alumnoId: number) {
    const asignaciones = await this.alumnoLibroRepository.find({
      where: { alumnoId },
      relations: ['libro', 'libro.materia', 'ultimoSegmento'],
      order: { fechaAsignacion: 'DESC' },
    });

    const data = asignaciones.map((a) => ({
      ...a.libro,
      alumnoLibroId: a.id,
      progreso: a.porcentaje,
      ultimoSegmentoId: a.ultimoSegmentoId,
      ultimaLectura: a.ultimaLectura,
      fechaAsignacion: a.fechaAsignacion,
    }));

    return {
      message: 'Libros asignados obtenidos correctamente.',
      description: `Tienes ${data.length} libro(s) asignado(s).`,
      total: data.length,
      data,
    };
  }

  /**
   * Obtiene el escuelaId de un alumno (para validaciones de director).
   */
  async obtenerEscuelaIdDeAlumno(alumnoId: number): Promise<number> {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
      select: ['id', 'escuelaId'],
    });
    if (!alumno) {
      throw new NotFoundException(
        `No se encontró el alumno con ID ${alumnoId}`,
      );
    }
    return Number(alumno.escuelaId);
  }

  /**
   * Libros disponibles para asignar a un alumno (con licencias disponibles, mismo grado/grupo).
   */
  async listarLibrosDisponiblesParaAsignar(escuelaId: number, alumnoId: number) {
    return await this.licenciasService.listarLibrosDisponiblesParaAsignar(escuelaId, alumnoId);
  }

  /**
   * Asignar libro a alumno (maestro o director). Consume una licencia disponible.
   */
  async asignarLibroAlAlumno(
    escuelaId: number,
    alumnoId: number,
    libroId: number,
    asignadoPorTipo: 'maestro' | 'director',
    asignadoPorId: number,
    auditContext?: AuditContext,
  ) {
    const result = await this.licenciasService.consumirLicenciaParaAlumno(
      escuelaId,
      alumnoId,
      libroId,
      asignadoPorTipo,
      asignadoPorId,
    );
    await this.auditService.log(
      asignadoPorTipo === 'director' ? 'director_asignar_libro' : 'maestro_asignar_libro',
      {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `escuelaId=${escuelaId} alumnoId=${alumnoId} libroId=${libroId} asignadoPor=${asignadoPorTipo}:${asignadoPorId}`,
      },
    );
    return result;
  }

  /**
   * Verificar si un libro está asignado al alumno (Alternativa C).
   */
  async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
    });
    return !!existe;
  }

  /**
   * Desasignar libro de alumno.
   * @param context - Si director: escuelaIdRestriccion. Si maestro: maestroId. Sin context = admin (sin restricción).
   */
  async desasignarLibroAlAlumno(
    alumnoId: number,
    libroId: number,
    context?: DesasignarLibroContext,
  ) {
    const asignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
      relations: ['alumno'],
    });
    if (!asignacion) {
      throw new NotFoundException('No se encontró la asignación libro-alumno.');
    }

    if (context?.escuelaIdRestriccion != null) {
      if (Number(asignacion.alumno?.escuelaId) !== Number(context.escuelaIdRestriccion)) {
        throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tu escuela.');
      }
    }

    if (context?.maestroId != null) {
      const enClase = await this.dataSource.getRepository(AlumnoMaestro).findOne({
        where: {
          maestroId: context.maestroId,
          alumnoId,
          fechaFin: IsNull(),
        },
      });
      if (!enClase) {
        const mgList = await this.maestroGrupoRepository.find({
          where: { maestroId: context.maestroId },
          relations: ['grupo'],
        });
        if (!asignacion.alumno || !alumnoPerteneceAGrupos(asignacion.alumno, mgList)) {
          throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tus grupos.');
        }
      }
    }

    await this.alumnoLibroRepository.remove(asignacion);
    const accion = context?.escuelaIdRestriccion != null ? 'director_desasignar_libro' : context?.maestroId != null ? 'maestro_desasignar_libro' : null;
    if (accion && context?.auditContext) {
      await this.auditService.log(accion, {
        usuarioId: context.auditContext.usuarioId ?? null,
        ip: context.auditContext.ip ?? null,
        detalles: `alumnoId=${alumnoId} libroId=${libroId}`,
      });
    }
    return {
      message: 'Libro desasignado correctamente.',
      description: 'El alumno ya no verá este libro en "Mis libros".',
    };
  }

  /**
   * Actualizar progreso de lectura del alumno en un libro.
   */
  async crearAnotacionAlumno(alumnoId: number, dto: CrearAnotacionDto) {
    if (dto.offsetFin <= dto.offsetInicio) {
      throw new BadRequestException('offsetFin debe ser mayor a offsetInicio.');
    }

    const [alumno, libroAsignado, segmento] = await Promise.all([
      this.alumnoRepository.findOne({ where: { id: alumnoId }, select: ['id'] }),
      this.alumnoLibroRepository.findOne({
        where: { alumnoId, libroId: dto.libroId },
        select: ['id'],
      }),
      this.segmentoRepository.findOne({
        where: { id: dto.segmentoId },
        select: ['id', 'libroId', 'contenido'],
      }),
    ]);

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado.');
    }
    if (!libroAsignado) {
      throw new ForbiddenException('No tienes asignado este libro.');
    }
    if (!segmento) {
      throw new NotFoundException('Segmento no encontrado.');
    }
    if (Number(segmento.libroId) !== Number(dto.libroId)) {
      throw new BadRequestException('El segmento no pertenece al libro enviado.');
    }

    const largo = (segmento.contenido || '').length;
    if (dto.offsetInicio < 0 || dto.offsetFin > largo) {
      throw new BadRequestException('Offsets fuera del rango del contenido del segmento.');
    }

    if (dto.tipo === 'highlight' && !dto.color) {
      throw new BadRequestException('Para tipo "highlight" debes enviar color.');
    }
    if (dto.tipo === 'comentario' && (!dto.comentario || dto.comentario.trim().length === 0)) {
      throw new BadRequestException('Para tipo "comentario" debes enviar comentario.');
    }

    const anotacion = this.anotacionRepository.create({
      alumnoId,
      libroId: dto.libroId,
      segmentoId: dto.segmentoId,
      tipo: dto.tipo,
      textoSeleccionado: dto.textoSeleccionado,
      offsetInicio: dto.offsetInicio,
      offsetFin: dto.offsetFin,
      color: dto.tipo === 'highlight' ? dto.color ?? null : null,
      comentario: dto.tipo === 'comentario' ? (dto.comentario ?? '').trim() : null,
    });
    const guardada = await this.anotacionRepository.save(anotacion);

    return {
      message: 'Anotación guardada correctamente.',
      data: guardada,
    };
  }

  async eliminarAnotacionAlumno(alumnoId: number, anotacionId: number) {
    const anotacion = await this.anotacionRepository.findOne({
      where: { id: anotacionId },
      select: ['id', 'alumnoId'],
    });
    if (!anotacion) {
      throw new NotFoundException('Anotación no encontrada.');
    }
    if (Number(anotacion.alumnoId) !== Number(alumnoId)) {
      throw new ForbiddenException('No puedes eliminar anotaciones de otro alumno.');
    }

    await this.anotacionRepository.delete({ id: anotacionId });
    return {
      message: 'Anotación eliminada correctamente.',
      data: { id: anotacionId },
    };
  }

  async listarAnotacionesAlumnoPorLibro(alumnoId: number, libroId: number) {
    const existeAsignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
      select: ['id'],
    });
    if (!existeAsignacion) {
      throw new ForbiddenException('No tienes asignado este libro.');
    }

    const data = await this.anotacionRepository.find({
      where: { alumnoId, libroId },
      order: { creadoEn: 'ASC' },
    });

    return {
      message: 'Anotaciones obtenidas correctamente.',
      total: data.length,
      data,
    };
  }

  /**
   * Actualizar progreso de lectura del alumno en un libro.
   */
  async actualizarProgresoLibro(
    alumnoId: number,
    libroId: number,
    dto: { porcentaje?: number; ultimoSegmentoId?: number },
  ) {
    let asignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
      relations: ['libro'],
    });
    if (!asignacion) {
      throw new NotFoundException('No tienes asignado este libro.');
    }

    if (dto.porcentaje !== undefined) {
      asignacion.porcentaje = Math.max(0, Math.min(100, dto.porcentaje));
    }
    if (dto.ultimoSegmentoId !== undefined) {
      asignacion.ultimoSegmentoId = dto.ultimoSegmentoId;
    }
    asignacion.ultimaLectura = new Date();
    await this.alumnoLibroRepository.save(asignacion);

    return {
      message: 'Progreso actualizado correctamente.',
      data: {
        alumnoLibroId: asignacion.id,
        libroId,
        progreso: asignacion.porcentaje,
        ultimoSegmentoId: asignacion.ultimoSegmentoId,
        ultimaLectura: asignacion.ultimaLectura,
      },
    };
  }
}
