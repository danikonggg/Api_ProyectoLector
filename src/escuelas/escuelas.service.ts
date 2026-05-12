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
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { grupoCoincide } from '../common/utils/grupo.utils';
import { LicenciasService } from '../licencias/licencias.service';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { AuditService } from '../audit/audit.service';
import { ListarLibrosAsignadosAlumnoUseCase } from './application/listar-libros-asignados-alumno.use-case';
import { DesasignarLibroAlumnoUseCase } from './application/desasignar-libro-alumno.use-case';
import { AlumnoEvaluacionSegmentoService } from './services/alumno-evaluacion-segmento.service';
import { AlumnoAnotacionesProgresoService } from './services/alumno-anotaciones-progreso.service';
import type { CrearAnotacionDto } from './dto/crear-anotacion.dto';

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
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly licenciasService: LicenciasService,
    private readonly listarLibrosAsignadosAlumnoUseCase: ListarLibrosAsignadosAlumnoUseCase,
    private readonly desasignarLibroAlumnoUseCase: DesasignarLibroAlumnoUseCase,
    private readonly alumnoEvaluacionSegmentoService: AlumnoEvaluacionSegmentoService,
    private readonly alumnoAnotacionesProgresoService: AlumnoAnotacionesProgresoService,
  ) {}

  /**
   * Crear una nueva escuela
   */
  async crear(crearEscuelaDto: CrearEscuelaDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de creación de escuela: ${crearEscuelaDto.nombre}`);

    const escuelaExistente = await this.prisma.escuela.findFirst({
      where: { nombre: crearEscuelaDto.nombre },
    });

    if (escuelaExistente) {
      this.logger.warn(`Creación fallida: Escuela con nombre duplicado - ${crearEscuelaDto.nombre}`);
      throw new ConflictException('Ya existe una escuela con ese nombre');
    }

    if (crearEscuelaDto.clave) {
      const escuelaConClave = await this.prisma.escuela.findFirst({
        where: { clave: crearEscuelaDto.clave },
      });

      if (escuelaConClave) {
        this.logger.warn(`Creación fallida: Escuela con clave duplicada - ${crearEscuelaDto.clave}`);
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    const escuelaGuardada = await this.prisma.escuela.create({
      data: {
        nombre: crearEscuelaDto.nombre,
        nivel: crearEscuelaDto.nivel,
        clave: crearEscuelaDto.clave || null,
        direccion: crearEscuelaDto.direccion || null,
        telefono: crearEscuelaDto.telefono || null,
        estado: crearEscuelaDto.estado || 'activa',
        ciudad: crearEscuelaDto.ciudad || null,
        estadoRegion: crearEscuelaDto.estadoRegion || null,
      },
    });

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
    const escuelas = await this.prisma.escuela.findMany({
      where: { estado: 'activa' },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
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
    const total = await this.prisma.escuela.count();

    const escuelas = await this.prisma.escuela.findMany({
      orderBy: { nombre: 'asc' },
      ...(page != null && limit != null && page >= 1 && limit >= 1
        ? { skip: (page - 1) * limit, take: limit }
        : {}),
    });

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
      this.prisma.director.findMany({
        where: { escuelaId: { in: escuelaIds }, activo: true },
        include: { persona: true },
      }),
      this.prisma.$queryRaw<Array<{ escuelaId: bigint; total: bigint }>>`
        SELECT escuela_id AS "escuelaId", COUNT(*) AS total
        FROM "Alumno"
        WHERE escuela_id IN (${Prisma.join(escuelaIds)}) AND activo = true
        GROUP BY escuela_id
      `,
      this.prisma.$queryRaw<Array<{ escuelaId: bigint; total: bigint }>>`
        SELECT escuela_id AS "escuelaId", COUNT(*) AS total
        FROM "Maestro"
        WHERE escuela_id IN (${Prisma.join(escuelaIds)})
        GROUP BY escuela_id
      `,
      this.prisma.$queryRaw<Array<{ escuelaId: bigint; total: bigint }>>`
        SELECT escuela_id AS "escuelaId",
               COUNT(DISTINCT (grado::text || '-' || COALESCE(grupo, ''))) AS total
        FROM "Alumno"
        WHERE escuela_id IN (${Prisma.join(escuelaIds)}) AND activo = true
        GROUP BY escuela_id
      `,
    ]);

    const mapDirectores = new Map<number, string[]>();
    for (const d of directores) {
      const list = mapDirectores.get(Number(d.escuelaId)) ?? [];
      const nombreCompleto = [
        d.persona?.nombre,
        d.persona?.apellidoPaterno,
        d.persona?.apellidoMaterno,
      ]
        .filter(Boolean)
        .join(' ');
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
   * Estadísticas del panel de gestión de escuelas.
   */
  async obtenerEstadisticasPanel() {
    const [totalEscuelas, escuelasActivas, totalAlumnos, totalProfesores, librosListos] =
      await Promise.all([
        this.prisma.escuela.count(),
        this.prisma.escuela.count({ where: { estado: 'activa' } }),
        this.prisma.alumno.count(),
        this.prisma.maestro.count(),
        this.prisma.libro.count({ where: { estado: 'listo' } }),
      ]);

    return {
      message: 'Estadísticas del panel de escuelas obtenidas correctamente',
      data: {
        totalEscuelas,
        escuelasActivas,
        totalAlumnos,
        totalProfesores,
        licencias: librosListos,
      },
    };
  }

  /**
   * Obtener una escuela por ID.
   */
  async obtenerPorId(id: number) {
    const escuela = await this.prisma.escuela.findUnique({
      where: { id: BigInt(id) },
      include: { directores: { include: { persona: true } } },
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    const [totalAlumnos, totalMaestros, gruposRaw] = await Promise.all([
      this.prisma.alumno.count({ where: { escuelaId: BigInt(id) } }),
      this.prisma.maestro.count({ where: { escuelaId: BigInt(id) } }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT (grado::text || '-' || COALESCE(grupo, ''))) AS count
        FROM "Alumno"
        WHERE escuela_id = ${BigInt(id)}
      `,
    ]);

    const totalGrupos = gruposRaw[0]?.count ? Number(gruposRaw[0].count) : 0;

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
  async actualizar(
    id: number,
    actualizarEscuelaDto: ActualizarEscuelaDto,
    auditContext?: AuditContext,
  ) {
    this.logger.log(`Intento de actualización de escuela ID: ${id}`);

    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(id) } });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    if (actualizarEscuelaDto.nombre && actualizarEscuelaDto.nombre !== escuela.nombre) {
      const escuelaConNombre = await this.prisma.escuela.findFirst({
        where: { nombre: actualizarEscuelaDto.nombre },
      });
      if (escuelaConNombre) {
        throw new ConflictException('Ya existe una escuela con ese nombre');
      }
    }

    if (actualizarEscuelaDto.clave && actualizarEscuelaDto.clave !== escuela.clave) {
      const escuelaConClave = await this.prisma.escuela.findFirst({
        where: { clave: actualizarEscuelaDto.clave },
      });
      if (escuelaConClave) {
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    const estadoAnterior = escuela.estado ?? 'activa';

    const escuelaActualizada = await this.prisma.escuela.update({
      where: { id: BigInt(id) },
      data: {
        ...(actualizarEscuelaDto.nombre != null && { nombre: actualizarEscuelaDto.nombre }),
        ...(actualizarEscuelaDto.nivel != null && { nivel: actualizarEscuelaDto.nivel }),
        ...(actualizarEscuelaDto.clave !== undefined && { clave: actualizarEscuelaDto.clave || null }),
        ...(actualizarEscuelaDto.direccion !== undefined && { direccion: actualizarEscuelaDto.direccion || null }),
        ...(actualizarEscuelaDto.telefono !== undefined && { telefono: actualizarEscuelaDto.telefono || null }),
        ...(actualizarEscuelaDto.estado != null && { estado: actualizarEscuelaDto.estado }),
        ...(actualizarEscuelaDto.ciudad !== undefined && { ciudad: actualizarEscuelaDto.ciudad || null }),
        ...(actualizarEscuelaDto.estadoRegion !== undefined && { estadoRegion: actualizarEscuelaDto.estadoRegion || null }),
      },
    });

    const estadoNuevo = escuelaActualizada.estado ?? 'activa';
    const esInactiva = estadoNuevo === 'inactiva' || estadoNuevo === 'suspendida';
    const activoValor = !esInactiva;

    if (estadoAnterior !== estadoNuevo) {
      await Promise.all([
        this.prisma.alumno.updateMany({ where: { escuelaId: BigInt(id) }, data: { activo: activoValor } }),
        this.prisma.maestro.updateMany({ where: { escuelaId: BigInt(id) }, data: { activo: activoValor } }),
        this.prisma.director.updateMany({ where: { escuelaId: BigInt(id) }, data: { activo: activoValor } }),
        this.prisma.escuelaLibro.updateMany({ where: { escuelaId: BigInt(id) }, data: { activo: activoValor } }),
      ]);
      this.logger.log(
        `Escuela ID ${id}: cascada ${esInactiva ? 'desactivación' : 'reactivación'} aplicada.`,
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

    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(id) } });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const [alumnos, maestros, directores] = await Promise.all([
        tx.alumno.findMany({ where: { escuelaId: BigInt(id) }, select: { id: true, personaId: true } }),
        tx.maestro.findMany({ where: { escuelaId: BigInt(id) }, select: { id: true, personaId: true } }),
        tx.director.findMany({ where: { escuelaId: BigInt(id) }, select: { id: true, personaId: true } }),
      ]);

      const alumnoIds = alumnos.map((r) => r.id);
      const maestroIds = maestros.map((r) => r.id);
      const personaIds = [...alumnos, ...maestros, ...directores].map((r) => r.personaId);

      if (alumnoIds.length > 0) {
        await tx.sesionLectura.deleteMany({ where: { alumnoId: { in: alumnoIds } } });
        await tx.preferenciasAlumno.deleteMany({ where: { alumnoId: { in: alumnoIds } } });
        await tx.alumnoSegmentoEvaluacion.deleteMany({ where: { alumnoId: { in: alumnoIds } } });
        await tx.anotacion.deleteMany({ where: { alumnoId: { in: alumnoIds } } });
        await tx.alumnoLibro.deleteMany({ where: { alumnoId: { in: alumnoIds } } });
      }

      if (maestroIds.length > 0) {
        await tx.maestroGrupo.deleteMany({ where: { maestroId: { in: maestroIds } } });
      }

      if (alumnoIds.length > 0 || maestroIds.length > 0) {
        await tx.alumnoMaestro.deleteMany({
          where: {
            OR: [
              ...(alumnoIds.length > 0 ? [{ alumnoId: { in: alumnoIds } }] : []),
              ...(maestroIds.length > 0 ? [{ maestroId: { in: maestroIds } }] : []),
            ],
          },
        });
      }

      await tx.licenciaLibro.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.escuelaLibro.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.escuelaLibroPendiente.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.director.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.alumno.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.maestro.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.grupo.deleteMany({ where: { escuelaId: BigInt(id) } });
      await tx.escuela.delete({ where: { id: BigInt(id) } });

      if (personaIds.length > 0) {
        await tx.persona.deleteMany({ where: { id: { in: personaIds } } });
      }
    });

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
    const count = await this.prisma.escuela.count({ where: { id: BigInt(id) } });
    return count > 0;
  }

  /**
   * Obtener una escuela sin relaciones (método interno)
   */
  async obtenerUna(id: number) {
    return await this.prisma.escuela.findUnique({ where: { id: BigInt(id) } });
  }

  /**
   * Listar directores activos de una escuela.
   */
  async listarDirectoresDeEscuela(escuelaId: number) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const directoresEntidad = await this.prisma.director.findMany({
      where: { escuelaId: BigInt(escuelaId), activo: true },
      include: { persona: true },
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
    const escuelas = await this.prisma.escuela.findMany({
      include: {
        directores: {
          where: { activo: true },
          include: { persona: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const directores: Array<{
      id: bigint;
      personaId: bigint;
      escuelaId: bigint;
      fechaNombramiento: Date | null;
      persona: {
        id: bigint;
        nombre: string;
        apellidoPaterno: string;
        apellidoMaterno: string | null;
        correo: string;
        telefono: string | null;
        genero: string | null;
      } | null;
      escuela: { id: bigint; nombre: string; nivel: string; clave: string | null };
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
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const maestrosEntidad = await this.prisma.maestro.findMany({
      where: { escuelaId: BigInt(escuelaId), activo: true },
      include: { persona: true },
    });

    const maestroIds = maestrosEntidad.map((m) => m.id);
    const gruposPorMaestro = new Map<
      bigint,
      Array<{ id: bigint; grado: number; nombre: string; cantidadAlumnos: number }>
    >();
    const cantidadAlumnosPorGrupo = new Map<bigint, number>();

    if (maestroIds.length > 0) {
      const asignaciones = await this.prisma.maestroGrupo.findMany({
        where: { maestroId: { in: maestroIds } },
        include: { grupo: true },
      });
      const gruposUnicos: Array<{ id: bigint; grado: number; nombre: string }> = [];
      for (const a of asignaciones) {
        if (!a.grupo || gruposUnicos.some((g) => g.id === a.grupo!.id)) continue;
        gruposUnicos.push({
          id: a.grupo.id,
          grado: Number(a.grupo.grado),
          nombre: a.grupo.nombre,
        });
      }

      if (gruposUnicos.length > 0) {
        const alumnosEnGrupos = await this.prisma.alumno.findMany({
          where: { escuelaId: BigInt(escuelaId), activo: true },
          select: { id: true, grupoId: true, grado: true, grupo: true },
        });
        for (const g of gruposUnicos) {
          const count = alumnosEnGrupos.filter(
            (a) =>
              (a.grupoId != null && a.grupoId === g.id) ||
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
   */
  async listarAlumnosDeEscuela(escuelaId: number) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const alumnosEntidad = await this.prisma.alumno.findMany({
      where: { escuelaId: BigInt(escuelaId), activo: true },
      include: { persona: true, padre: { include: { persona: true } } },
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
            fechaNacimiento:
              a.persona.fechaNacimiento != null
                ? a.persona.fechaNacimiento instanceof Date
                  ? a.persona.fechaNacimiento.toISOString().split('T')[0]
                  : String(a.persona.fechaNacimiento).split('T')[0]
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
   * Activar o desactivar un libro solo para una escuela.
   */
  async setLibroActivoEnEscuela(escuelaId: number, libroId: number, activo: boolean) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const el = await this.prisma.escuelaLibro.findFirst({
      where: { escuelaId: BigInt(escuelaId), libroId: BigInt(libroId) },
      include: { libro: true },
    });
    if (!el) {
      throw new NotFoundException(
        `El libro con ID ${libroId} no está asignado a la escuela con ID ${escuelaId}.`,
      );
    }
    await this.prisma.escuelaLibro.update({ where: { id: el.id }, data: { activo } });
    this.logger.log(`Escuela ${escuelaId} / libro ${libroId}: activo=${activo}.`);
    return {
      message: activo
        ? 'Libro activado para esta escuela.'
        : 'Libro desactivado para esta escuela.',
      data: { escuelaId, libroId, activo, titulo: el.libro?.titulo },
    };
  }

  /**
   * Listar todas las escuelas con los libros que tiene cada una (admin).
   */
  async listarEscuelasConLibros() {
    const asignaciones = await this.prisma.escuelaLibro.findMany({
      include: { escuela: true, libro: { include: { materia: true } } },
      orderBy: { escuelaId: 'asc' },
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
      const escuelaNum = Number(a.escuelaId);
      if (!byEscuela.has(escuelaNum)) {
        byEscuela.set(escuelaNum, {
          escuelaId: Number(a.escuela.id),
          nombreEscuela: a.escuela.nombre,
          ciudad: a.escuela.ciudad ?? null,
          estadoRegion: a.escuela.estadoRegion ?? null,
          estado: a.escuela.estado ?? 'activa',
          libros: [],
        });
      }
      const entry = byEscuela.get(escuelaNum)!;
      entry.libros.push({
        escuelaLibroId: Number(a.id),
        libroId: Number(a.libroId),
        titulo: a.libro?.titulo ?? '',
        codigo: a.libro?.codigo ?? '',
        grado: Number(a.libro?.grado ?? 0),
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
      description:
        'Cada escuela puede tener el mismo libro asignado; las asignaciones son independientes por escuela.',
      total: data.length,
      data,
    };
  }

  /**
   * Listar todas las asignaciones libro-escuela para que el admin vea y pueda asignar/desasignar.
   */
  async listarAsignacionesLibrosDeEscuela(escuelaId: number) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const asignaciones = await this.prisma.escuelaLibro.findMany({
      where: { escuelaId: BigInt(escuelaId) },
      include: { libro: { include: { materia: true } } },
      orderBy: { fechaInicio: 'desc' },
    });
    const data = asignaciones.map((a) => ({
      escuelaLibroId: Number(a.id),
      libroId: Number(a.libroId),
      titulo: a.libro?.titulo,
      codigo: a.libro?.codigo,
      grado: Number(a.libro?.grado ?? 0),
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
   * Listar los libros asignados a una escuela.
   */
  async listarLibrosDeEscuela(escuelaId: number) {
    const escuela = await this.prisma.escuela.findUnique({ where: { id: BigInt(escuelaId) } });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const asignaciones = await this.prisma.escuelaLibro.findMany({
      where: { escuelaId: BigInt(escuelaId), activo: true },
      include: { libro: { include: { materia: true } } },
      orderBy: { fechaInicio: 'desc' },
    });

    const asignacionesActivas = asignaciones.filter((a) => a.libro?.activo !== false);

    const libros = asignacionesActivas.map((a) => ({
      ...a.libro,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      escuelaLibroId: Number(a.id),
    }));

    return {
      message: 'Libros de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${libros.length} libro(s) asignado(s).`,
      total: libros.length,
      data: libros,
    };
  }

  /**
   * Listar libros asignados al alumno.
   */
  async listarLibrosAsignadosAlAlumno(alumnoId: number) {
    return this.listarLibrosAsignadosAlumnoUseCase.execute(alumnoId);
  }

  /**
   * Obtiene el escuelaId de un alumno (para validaciones de director).
   */
  async obtenerEscuelaIdDeAlumno(alumnoId: number): Promise<number> {
    const alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(alumnoId) },
      select: { id: true, escuelaId: true },
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
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
   * Verificar si un libro está asignado al alumno.
   */
  async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) },
    });
    if (!existe) return false;
    return this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
  }

  /**
   * Desasignar libro de alumno.
   */
  async desasignarLibroAlAlumno(
    alumnoId: number,
    libroId: number,
    context?: DesasignarLibroContext,
  ) {
    return this.desasignarLibroAlumnoUseCase.execute(alumnoId, libroId, context);
  }

  /**
   * Crear anotación del alumno.
   */
  async crearAnotacionAlumno(alumnoId: number, dto: CrearAnotacionDto) {
    return this.alumnoAnotacionesProgresoService.crearAnotacionAlumno(alumnoId, dto);
  }

  async eliminarAnotacionAlumno(alumnoId: number, anotacionId: number) {
    return this.alumnoAnotacionesProgresoService.eliminarAnotacionAlumno(alumnoId, anotacionId);
  }

  async listarAnotacionesAlumnoPorLibro(alumnoId: number, libroId: number) {
    return this.alumnoAnotacionesProgresoService.listarAnotacionesAlumnoPorLibro(alumnoId, libroId);
  }

  async actualizarProgresoLibro(
    alumnoId: number,
    libroId: number,
    dto: { porcentaje?: number; ultimoSegmentoId?: number },
  ) {
    return this.alumnoAnotacionesProgresoService.actualizarProgresoLibro(alumnoId, libroId, dto);
  }

  async obtenerEvaluacionSegmento(
    alumnoId: number,
    libroId: number,
    segmentoId: number,
    nivelSolicitado?: string,
  ) {
    return this.alumnoEvaluacionSegmentoService.obtenerEvaluacionSegmento(
      alumnoId,
      libroId,
      segmentoId,
      nivelSolicitado,
    );
  }

  async responderEvaluacionSegmento(
    alumnoId: number,
    libroId: number,
    segmentoId: number,
    dto: { respuestas: Array<{ preguntaId: string; respuesta: string }>; nivel?: string },
  ) {
    return this.alumnoEvaluacionSegmentoService.responderEvaluacionSegmento(
      alumnoId,
      libroId,
      segmentoId,
      dto,
    );
  }

  async crearReintentoEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number) {
    return this.alumnoEvaluacionSegmentoService.crearReintentoEvaluacionSegmento(
      alumnoId,
      libroId,
      segmentoId,
    );
  }
}
