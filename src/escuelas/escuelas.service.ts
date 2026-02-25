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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Director } from '../personas/entities/director.entity';
import { EscuelaLibro } from './entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from './entities/escuela-libro-pendiente.entity';
import { Libro } from '../libros/entities/libro.entity';
import { AlumnoLibro } from './entities/alumno-libro.entity';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { AuditService } from '../audit/audit.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
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
    @InjectRepository(EscuelaLibroPendiente)
    private readonly escuelaLibroPendienteRepository: Repository<EscuelaLibroPendiente>,
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    private readonly auditService: AuditService,
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
   * Obtener todas las escuelas. Listado simple, sin joins ni filtros.
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

    this.logger.log(`Consulta de escuelas: ${escuelas.length} encontradas`);

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Escuelas obtenidas exitosamente',
      description: `Se encontraron ${escuelas.length} escuela(s) en el sistema`,
      total,
      ...(meta && { meta }),
      data: escuelas,
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
            segundoNombre: d.persona.segundoNombre ?? null,
            apellidoPaterno: d.persona.apellidoPaterno,
            apellidoMaterno: d.persona.apellidoMaterno ?? null,
            apellido: [d.persona.apellidoPaterno, d.persona.apellidoMaterno].filter(Boolean).join(' ').trim() || null,
            correo: d.persona.correo,
            telefono: d.persona.telefono,
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
   * PASO 1 - Admin otorga un libro a una escuela.
   * Crea registro pendiente. El libro NO aparece en la escuela hasta que ella canjee.
   */
  async otorgarLibroPorCodigo(escuelaId: number, codigo: string) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const libro = await this.libroRepository.findOne({
      where: { codigo: codigo.trim() },
    });
    if (!libro) {
      throw new NotFoundException(
        `No se encontró ningún libro con código "${codigo}". Verifica el código en la lista de libros.`,
      );
    }
    if (libro.activo === false) {
      throw new BadRequestException(
        `El libro "${libro.titulo}" está desactivado globalmente. Actívalo primero en la lista de libros.`,
      );
    }

    // Ya canjeado = ya está en Escuela_Libro
    const yaCanjeado = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaCanjeado) {
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya está activo en esta escuela (ya fue canjeado).`,
      );
    }

    // Ya otorgado pendiente de canje
    const yaPendiente = await this.escuelaLibroPendienteRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaPendiente) {
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya fue otorgado a esta escuela. La escuela debe canjear el código.`,
      );
    }

    const pendiente = this.escuelaLibroPendienteRepository.create({
      escuelaId,
      libroId: libro.id,
    });
    await this.escuelaLibroPendienteRepository.save(pendiente);

    this.logger.log(
      `Libro otorgado (pendiente de canje): "${libro.titulo}" (${codigo}) → escuela ID ${escuelaId}`,
    );

    return {
      message: 'Libro otorgado a la escuela correctamente.',
      description: `El libro "${libro.titulo}" (código ${codigo}) está disponible para que la escuela lo canjee. La escuela debe introducir el código para activarlo.`,
      data: {
        pendienteId: pendiente.id,
        escuelaId,
        libroId: libro.id,
        codigo: libro.codigo,
        titulo: libro.titulo,
        estado: 'pendiente_de_canje',
      },
    };
  }

  /**
   * PASO 2 - La escuela (director) canjea el código.
   * Solo funciona si el admin ya otorgó ese libro a la escuela.
   * Crea Escuela_Libro y elimina el pendiente.
   */
  async canjearLibroPorCodigo(escuelaId: number, codigo: string, auditContext?: AuditContext) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const libro = await this.libroRepository.findOne({
      where: { codigo: codigo.trim() },
    });
    if (!libro) {
      throw new NotFoundException(
        `No se encontró ningún libro con código "${codigo}". Verifica el código.`,
      );
    }

    // Verificar que el admin otorgó este libro a esta escuela
    const pendiente = await this.escuelaLibroPendienteRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (!pendiente) {
      throw new BadRequestException(
        `Este libro (código ${codigo}) no ha sido otorgado a tu escuela por el administrador. Solicita que te asignen el libro primero.`,
      );
    }

    // Ya no debe existir en Escuela_Libro (por si acaso)
    const yaActivo = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaActivo) {
      await this.escuelaLibroPendienteRepository.remove(pendiente);
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya está activo en tu escuela.`,
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const el = this.escuelaLibroRepository.create({
      escuelaId,
      libroId: libro.id,
      activo: true,
      fechaInicio: hoy,
      fechaFin: null,
    });
    await this.escuelaLibroRepository.save(el);
    await this.escuelaLibroPendienteRepository.remove(pendiente);

    this.logger.log(
      `Libro canjeado: "${libro.titulo}" (${codigo}) → escuela ID ${escuelaId}`,
    );

    await this.auditService.log('libro_canjear', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${libro.titulo} (id: ${libro.id}, codigo: ${codigo}) → escuela ID ${escuelaId}`,
    });

    return {
      message: 'Libro canjeado correctamente.',
      description: `El libro "${libro.titulo}" ya está activo en tu escuela.`,
      data: {
        escuelaLibroId: el.id,
        escuelaId,
        libroId: libro.id,
        codigo: libro.codigo,
        titulo: libro.titulo,
        fechaInicio: el.fechaInicio,
      },
    };
  }

  /**
   * Listar libros pendientes de canjear (otorgados por admin, aún no canjeados por la escuela).
   * Director: solo ve título y grado (no código) para que no pueda copiarlo sin que el admin se lo entregue.
   * Admin: ve toda la información incluyendo el código.
   */
  async listarLibrosPendientesDeEscuela(escuelaId: number, paraDirector = false) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const pendientes = await this.escuelaLibroPendienteRepository.find({
      where: { escuelaId },
      relations: ['libro', 'libro.materia'],
      order: { fechaOtorgado: 'DESC' },
    });

    const libros = pendientes.map((p) => {
      if (paraDirector) {
        // Director: solo nombre y grado. Sin código ni ids sensibles.
        return {
          titulo: p.libro.titulo,
          grado: p.libro.grado,
          fechaOtorgado: p.fechaOtorgado,
        };
      }
      // Admin: información completa
      return {
        ...p.libro,
        fechaOtorgado: p.fechaOtorgado,
        pendienteId: p.id,
      };
    });

    return {
      message: 'Libros pendientes de canjear obtenidos correctamente.',
      description: paraDirector
        ? `Hay ${libros.length} libro(s) pendientes de canjear. Solicita el código al administrador para activarlos.`
        : `Hay ${libros.length} libro(s) otorgados pendientes de canjear.`,
      total: libros.length,
      data: libros,
    };
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
            segundoNombre: d.persona.segundoNombre ?? null,
            apellidoPaterno: d.persona.apellidoPaterno,
            apellidoMaterno: d.persona.apellidoMaterno ?? null,
            apellido: [d.persona.apellidoPaterno, d.persona.apellidoMaterno].filter(Boolean).join(' ').trim() || null,
            correo: d.persona.correo,
            telefono: d.persona.telefono,
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
      persona: { id: number; nombre: string; segundoNombre: string | null; apellidoPaterno: string; apellidoMaterno: string | null; correo: string; telefono: string | null } | null;
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
                segundoNombre: d.persona.segundoNombre ?? null,
            apellidoPaterno: d.persona.apellidoPaterno,
            apellidoMaterno: d.persona.apellidoMaterno ?? null,
                correo: d.persona.correo,
                telefono: d.persona.telefono ?? null,
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
   * Listar maestros activos de una escuela.
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
    const maestros = maestrosEntidad.map((m) => ({
      id: m.id,
      personaId: m.personaId,
      escuelaId: m.escuelaId,
      especialidad: m.especialidad,
      fechaContratacion: m.fechaContratacion,
      persona: m.persona
        ? {
            id: m.persona.id,
            nombre: m.persona.nombre,
            segundoNombre: m.persona.segundoNombre ?? null,
            apellidoPaterno: m.persona.apellidoPaterno,
            apellidoMaterno: m.persona.apellidoMaterno ?? null,
            apellido: [m.persona.apellidoPaterno, m.persona.apellidoMaterno].filter(Boolean).join(' ').trim() || null,
            correo: m.persona.correo,
            telefono: m.persona.telefono,
          }
        : null,
    }));
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
      cicloEscolar: a.cicloEscolar,
      persona: a.persona
        ? {
            id: a.persona.id,
            nombre: a.persona.nombre,
            segundoNombre: a.persona.segundoNombre ?? null,
            apellidoPaterno: a.persona.apellidoPaterno,
            apellidoMaterno: a.persona.apellidoMaterno ?? null,
            apellido: [a.persona.apellidoPaterno, a.persona.apellidoMaterno].filter(Boolean).join(' ').trim() || null,
            correo: a.persona.correo,
            telefono: a.persona.telefono,
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
                  segundoNombre: a.padre.persona.segundoNombre ?? null,
                  apellidoPaterno: a.padre.persona.apellidoPaterno,
                  apellidoMaterno: a.padre.persona.apellidoMaterno ?? null,
                  apellido: [a.padre.persona.apellidoPaterno, a.padre.persona.apellidoMaterno].filter(Boolean).join(' ').trim() || null,
                  correo: a.padre.persona.correo,
                  telefono: a.padre.persona.telefono,
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
   * Libros disponibles para asignar a un alumno (misma escuela, mismo grado, mismo grupo si aplica).
   */
  async listarLibrosDisponiblesParaAsignar(escuelaId: number, alumnoId: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    }
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('El alumno no pertenece a esta escuela.');
    }

    const asignaciones = await this.escuelaLibroRepository.find({
      where: { escuelaId, activo: true },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });

    // Filtrar: libro activo, mismo grado, grupo (si Escuela_Libro tiene grupo, debe coincidir; si null = todos)
    const disponibles = asignaciones.filter((a) => {
      if (!a.libro || a.libro.activo === false) return false;
      if (Number(a.libro.grado) !== Number(alumno.grado)) return false;
      if (a.grupo != null && a.grupo !== alumno.grupo) return false;
      return true;
    });

    // Excluir ya asignados
    const yaAsignados = await this.alumnoLibroRepository.find({
      where: { alumnoId },
      select: ['libroId'],
    });
    const idsAsignados = new Set(yaAsignados.map((x) => x.libroId));
    const filtrados = disponibles.filter((a) => !idsAsignados.has(a.libroId));

    const data = filtrados.map((a) => ({
      id: a.libro?.id,
      titulo: a.libro?.titulo,
      codigo: a.libro?.codigo,
      grado: a.libro?.grado,
      materia: a.libro?.materia?.nombre ?? null,
    }));

    return {
      message: 'Libros disponibles para asignar.',
      description: `Libros de la escuela que coinciden con el grado${alumno.grupo ? ` y grupo ${alumno.grupo}` : ''} del alumno.`,
      total: data.length,
      data,
    };
  }

  /**
   * Asignar libro a alumno (maestro o director).
   */
  async asignarLibroAlAlumno(
    escuelaId: number,
    alumnoId: number,
    libroId: number,
    asignadoPorTipo: 'maestro' | 'director',
    asignadoPorId: number,
  ) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    }
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('El alumno no pertenece a esta escuela.');
    }

    const escuelaLibro = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId, activo: true },
      relations: ['libro'],
    });
    if (!escuelaLibro || !escuelaLibro.libro) {
      throw new NotFoundException('El libro no está disponible en esta escuela.');
    }
    if (escuelaLibro.libro.activo === false) {
      throw new BadRequestException('El libro está inactivo.');
    }
    if (Number(escuelaLibro.libro.grado) !== Number(alumno.grado)) {
      throw new BadRequestException('El libro no corresponde al grado del alumno.');
    }
    if (escuelaLibro.grupo != null && escuelaLibro.grupo !== alumno.grupo) {
      throw new BadRequestException('El libro no corresponde al grupo del alumno.');
    }

    const existente = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
    });
    if (existente) {
      throw new ConflictException('El alumno ya tiene asignado este libro.');
    }

    const asignacion = this.alumnoLibroRepository.create({
      alumnoId,
      libroId,
      porcentaje: 0,
      ultimoSegmentoId: null,
      ultimaLectura: null,
      fechaAsignacion: new Date(),
      asignadoPorTipo,
      asignadoPorId,
    });
    await this.alumnoLibroRepository.save(asignacion);

    return {
      message: 'Libro asignado correctamente al alumno.',
      description: `El alumno puede ver el libro en "Mis libros".`,
      data: {
        alumnoLibroId: asignacion.id,
        alumnoId,
        libroId,
        titulo: escuelaLibro.libro.titulo,
      },
    };
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
   */
  async desasignarLibroAlAlumno(alumnoId: number, libroId: number) {
    const asignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
    });
    if (!asignacion) {
      throw new NotFoundException('No se encontró la asignación libro-alumno.');
    }
    await this.alumnoLibroRepository.remove(asignacion);
    return {
      message: 'Libro desasignado correctamente.',
      description: 'El alumno ya no verá este libro en "Mis libros".',
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
