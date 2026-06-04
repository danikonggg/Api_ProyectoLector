import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Servicio compartido de estadísticas de progreso y evaluación.
 *
 * No decide permisos: recibe el conjunto de alumnos permitidos (alumnoIds) ya
 * resuelto por quien lo llama (maestro = sus grupos, director = su escuela).
 */
@Injectable()
export class EstadisticasProgresoService {
  constructor(private readonly prisma: PrismaService) {}

  private nombreCompleto(
    persona?: {
      nombre?: string | null;
      apellidoPaterno?: string | null;
      apellidoMaterno?: string | null;
    } | null,
  ): string {
    if (!persona) return '';
    return [persona.nombre, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * #1 — Progreso de UN libro para un conjunto de alumnos.
   * Para cada alumno con el libro asignado: % de avance, última lectura,
   * segmentos aprobados y promedio de evaluación.
   */
  async progresoLibroPorAlumnos(libroId: number, alumnoIds: bigint[]) {
    const libroIdBig = BigInt(libroId);

    const libro = await this.prisma.libro.findUnique({
      where: { id: libroIdBig },
      select: { id: true, titulo: true, autor: true },
    });
    if (!libro) {
      throw new NotFoundException('Libro no encontrado.');
    }

    const totalSegmentos = await this.prisma.segmento.count({
      where: { libroId: libroIdBig },
    });

    if (alumnoIds.length === 0) {
      return {
        message: 'Progreso del libro obtenido correctamente.',
        data: {
          libro: { id: Number(libro.id), titulo: libro.titulo, autor: libro.autor },
          totalSegmentos,
          totalAlumnos: 0,
          data: [],
        },
      };
    }

    const asignaciones = await this.prisma.alumnoLibro.findMany({
      where: { libroId: libroIdBig, alumnoId: { in: alumnoIds } },
      include: {
        alumno: {
          include: {
            persona: {
              select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true },
            },
          },
        },
      },
    });

    const evalAgg = await this.prisma.$queryRaw<
      Array<{ alumnoId: bigint; aprobados: bigint; promedio: string | null }>
    >`
      SELECT alumno_id as "alumnoId",
             COUNT(DISTINCT segmento_id) FILTER (WHERE aprobado = true) as "aprobados",
             AVG(score) as "promedio"
      FROM "Alumno_Segmento_Evaluacion"
      WHERE libro_id = ${libroIdBig}
        AND alumno_id IN (${Prisma.join(alumnoIds)})
      GROUP BY alumno_id
    `;

    const evalMap = new Map<number, { aprobados: number; promedio: number }>();
    for (const r of evalAgg) {
      evalMap.set(Number(r.alumnoId), {
        aprobados: Number(r.aprobados || 0),
        promedio: r.promedio != null ? Math.round(Number(r.promedio)) : 0,
      });
    }

    const data = asignaciones.map((a) => {
      const ev = evalMap.get(Number(a.alumnoId)) ?? { aprobados: 0, promedio: 0 };
      return {
        alumnoId: Number(a.alumnoId),
        nombre: this.nombreCompleto(a.alumno?.persona),
        progreso: a.porcentaje,
        ultimaLectura: a.ultimaLectura,
        segmentosAprobados: ev.aprobados,
        totalSegmentos,
        scorePromedio: ev.promedio,
      };
    });

    // Ordenar por menor progreso primero (los que necesitan atención arriba)
    data.sort((x, y) => x.progreso - y.progreso);

    return {
      message: 'Progreso del libro obtenido correctamente.',
      data: {
        libro: { id: Number(libro.id), titulo: libro.titulo, autor: libro.autor },
        totalSegmentos,
        totalAlumnos: data.length,
        data,
      },
    };
  }

  /**
   * #2 — Detalle libro por libro de UN alumno (progreso de cada libro asignado).
   */
  async detalleLibrosDeAlumno(alumnoId: number) {
    const alumnoIdBig = BigInt(alumnoId);

    const asignaciones = await this.prisma.alumnoLibro.findMany({
      where: { alumnoId: alumnoIdBig },
      include: { libro: { include: { materia: { select: { id: true, nombre: true } } } } },
      orderBy: { fechaAsignacion: 'desc' },
    });

    const data = asignaciones.map((a) => ({
      libroId: Number(a.libroId),
      titulo: a.libro?.titulo ?? '',
      autor: a.libro?.autor ?? null,
      materia: a.libro?.materia
        ? { id: Number(a.libro.materia.id), nombre: a.libro.materia.nombre }
        : null,
      progreso: a.porcentaje,
      ultimoSegmentoId: a.ultimoSegmentoId != null ? Number(a.ultimoSegmentoId) : null,
      ultimaLectura: a.ultimaLectura,
      fechaAsignacion: a.fechaAsignacion,
    }));

    return {
      message: 'Detalle de libros del alumno obtenido correctamente.',
      total: data.length,
      data,
    };
  }

  /**
   * #3 — Detalle de evaluaciones de UN alumno: cada intento por segmento con
   * su score, si aprobó, intento y tipos de error. Agrupado por libro.
   */
  async evaluacionesDeAlumno(alumnoId: number) {
    const alumnoIdBig = BigInt(alumnoId);

    const evaluaciones = await this.prisma.alumnoSegmentoEvaluacion.findMany({
      where: { alumnoId: alumnoIdBig },
      orderBy: [{ libroId: 'asc' }, { segmentoId: 'asc' }, { intento: 'asc' }],
      select: {
        libroId: true,
        segmentoId: true,
        nivelPregunta: true,
        intento: true,
        score: true,
        aprobado: true,
        tiposError: true,
        tiempoRespuestaMs: true,
        creadoEn: true,
      },
    });

    const libroIds = Array.from(new Set(evaluaciones.map((e) => e.libroId)));
    const libros =
      libroIds.length > 0
        ? await this.prisma.libro.findMany({
            where: { id: { in: libroIds } },
            select: { id: true, titulo: true },
          })
        : [];
    const tituloMap = new Map(libros.map((l) => [Number(l.id), l.titulo]));

    // Agrupar por libro
    const gruposMap = new Map<
      number,
      {
        libroId: number;
        titulo: string;
        segmentosAprobados: Set<number>;
        intentos: Array<Record<string, unknown>>;
      }
    >();

    for (const e of evaluaciones) {
      const libroIdNum = Number(e.libroId);
      if (!gruposMap.has(libroIdNum)) {
        gruposMap.set(libroIdNum, {
          libroId: libroIdNum,
          titulo: tituloMap.get(libroIdNum) ?? '',
          segmentosAprobados: new Set<number>(),
          intentos: [],
        });
      }
      const grupo = gruposMap.get(libroIdNum)!;
      if (e.aprobado) grupo.segmentosAprobados.add(Number(e.segmentoId));
      grupo.intentos.push({
        segmentoId: Number(e.segmentoId),
        nivelPregunta: e.nivelPregunta,
        intento: e.intento,
        score: e.score,
        aprobado: e.aprobado,
        tiposError: e.tiposError ?? [],
        tiempoRespuestaMs: e.tiempoRespuestaMs ?? null,
        fecha: e.creadoEn,
      });
    }

    const data = Array.from(gruposMap.values()).map((g) => ({
      libroId: g.libroId,
      titulo: g.titulo,
      segmentosAprobados: g.segmentosAprobados.size,
      totalIntentos: g.intentos.length,
      intentos: g.intentos,
    }));

    return {
      message: 'Evaluaciones del alumno obtenidas correctamente.',
      total: evaluaciones.length,
      data,
    };
  }

  /**
   * #4 — Agregados de lectura/evaluación para un conjunto de alumnos
   * (usado por el dashboard del director, escala a toda la escuela).
   */
  async agregadosDeAlumnos(alumnoIds: bigint[]) {
    if (alumnoIds.length === 0) {
      return {
        progresoPromedio: 0,
        tiempoTotalMinutos: 0,
        porcentajeAprobacion: 0,
        evaluacionesRealizadas: 0,
      };
    }

    const [progresoAgg, tiempoAgg, evalAgg] = await Promise.all([
      this.prisma.$queryRaw<Array<{ promedio: string | null }>>`
        SELECT AVG(porcentaje) as "promedio"
        FROM "Alumno_Libro"
        WHERE alumno_id IN (${Prisma.join(alumnoIds)})
      `,
      this.prisma.$queryRaw<Array<{ segundos: string | null }>>`
        SELECT SUM(duracion_segundos) as "segundos"
        FROM "Sesion_Lectura"
        WHERE alumno_id IN (${Prisma.join(alumnoIds)})
      `,
      this.prisma.$queryRaw<Array<{ total: bigint; aprobadas: bigint }>>`
        SELECT COUNT(*) as "total",
               COUNT(*) FILTER (WHERE aprobado = true) as "aprobadas"
        FROM "Alumno_Segmento_Evaluacion"
        WHERE alumno_id IN (${Prisma.join(alumnoIds)})
      `,
    ]);

    const progresoPromedio =
      progresoAgg[0]?.promedio != null ? Math.round(Number(progresoAgg[0].promedio)) : 0;
    const tiempoTotalMinutos =
      tiempoAgg[0]?.segundos != null ? Math.round(Number(tiempoAgg[0].segundos) / 60) : 0;
    const total = Number(evalAgg[0]?.total ?? 0);
    const aprobadas = Number(evalAgg[0]?.aprobadas ?? 0);
    const porcentajeAprobacion = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

    return {
      progresoPromedio,
      tiempoTotalMinutos,
      porcentajeAprobacion,
      evaluacionesRealizadas: total,
    };
  }
}
