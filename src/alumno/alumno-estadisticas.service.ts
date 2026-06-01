import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function dateKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function computeStreakUTC(keys: string[], todayKey: string): { actual: number; maxima: number } {
  const set = new Set(keys);
  let actual = 0;
  let cursor = new Date(`${todayKey}T00:00:00.000Z`);
  while (set.has(dateKeyUTC(cursor))) {
    actual += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  const sorted = Array.from(set).sort();
  let maxima = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    if (!prev) {
      run = 1;
    } else {
      const prevD = new Date(`${prev}T00:00:00.000Z`).getTime();
      const curD = new Date(`${k}T00:00:00.000Z`).getTime();
      run = curD - prevD === 24 * 60 * 60 * 1000 ? run + 1 : 1;
    }
    maxima = Math.max(maxima, run);
    prev = k;
  }
  return { actual, maxima };
}

@Injectable()
export class AlumnoEstadisticasService {
  constructor(private readonly prisma: PrismaService) {}

  async getEstadisticas(alumnoId: number) {
    const alumnoIdBig = BigInt(alumnoId);

    const [alumnoLibros, sesiones] = await Promise.all([
      this.prisma.alumnoLibro.findMany({
        where: { alumnoId: alumnoIdBig },
        select: { id: true, libroId: true, porcentaje: true, ultimaLectura: true },
      }),
      this.prisma.sesionLectura.findMany({
        where: { alumnoId: alumnoIdBig },
        select: { duracionSegundos: true, fechaFin: true },
        orderBy: { fechaFin: 'desc' },
      }),
    ]);

    const evalAgg = await this.prisma.$queryRaw<[{ avgScore: string | null; aprobados: string }]>`
      SELECT
        AVG(score)::text AS "avgScore",
        COUNT(DISTINCT segmento_id) FILTER (WHERE aprobado = true)::text AS "aprobados"
      FROM "Alumno_Segmento_Evaluacion"
      WHERE alumno_id = ${alumnoIdBig}
    `;

    const anotacionesAgg = await this.prisma.$queryRaw<[{ total: string }]>`
      SELECT COUNT(*)::text AS "total" FROM "Anotacion" WHERE alumno_id = ${alumnoIdBig}
    `;

    const librosLeidos = alumnoLibros.filter((x) => Number(x.porcentaje) >= 100).length;
    const librosEnProgreso = alumnoLibros.filter(
      (x) => Number(x.porcentaje) > 0 && Number(x.porcentaje) < 100,
    ).length;

    const tiempoTotalMinutos = Math.floor(
      sesiones.reduce((sum, s) => sum + Math.max(0, Number(s.duracionSegundos || 0)), 0) / 60,
    );

    const now = new Date();
    const som = startOfMonth(now).getTime();
    const tiempoEsteMesMinutos = Math.floor(
      sesiones
        .filter((s) => (s.fechaFin ? new Date(s.fechaFin).getTime() >= som : false))
        .reduce((sum, s) => sum + Math.max(0, Number(s.duracionSegundos || 0)), 0) / 60,
    );

    const promedioEvaluaciones =
      evalAgg[0]?.avgScore != null && !isNaN(Number(evalAgg[0].avgScore))
        ? Number(evalAgg[0].avgScore)
        : 0;

    const actividadFechas = sesiones
      .map((s) => (s.fechaFin ? dateKeyUTC(new Date(s.fechaFin)) : null))
      .filter((x): x is string => !!x);
    const { actual, maxima } = computeStreakUTC(actividadFechas, dateKeyUTC(now));

    const segmentosCompletados = Number(evalAgg[0]?.aprobados || 0);
    const anotacionesTotales = Number(anotacionesAgg[0]?.total || 0);
    const ultimaActividad = sesiones.length > 0 ? sesiones[0].fechaFin : null;

    return {
      data: {
        librosLeidos,
        librosEnProgreso,
        tiempoTotalMinutos,
        tiempoEsteMesMinutos,
        promedioEvaluaciones,
        rachaActualDias: actual,
        rachaMaximaDias: maxima,
        segmentosCompletados,
        anotacionesTotales,
        ultimaActividad,
      },
    };
  }
}
