import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';
import { AlumnoSegmentoEvaluacion } from '../escuelas/entities/alumno-segmento-evaluacion.entity';
import { Anotacion } from '../escuelas/entities/anotacion.entity';
import { SesionLectura } from './entities/sesion-lectura.entity';

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
  constructor(
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(SesionLectura)
    private readonly sesionLecturaRepository: Repository<SesionLectura>,
    @InjectRepository(AlumnoSegmentoEvaluacion)
    private readonly evaluacionRepository: Repository<AlumnoSegmentoEvaluacion>,
    @InjectRepository(Anotacion)
    private readonly anotacionRepository: Repository<Anotacion>,
  ) {}

  async getEstadisticas(alumnoId: number) {
    const [alumnoLibros, sesiones, evalAgg, anotacionesCountAgg] = await Promise.all([
      this.alumnoLibroRepository.find({
        where: { alumnoId },
        select: ['id', 'libroId', 'porcentaje', 'ultimaLectura'],
      }),
      this.sesionLecturaRepository.find({
        where: { alumnoId },
        select: ['duracionSegundos', 'fechaFin'],
        order: { fechaFin: 'DESC' },
      }),
      this.evaluacionRepository
        .createQueryBuilder('e')
        .select('AVG(e.score)', 'avgScore')
        .addSelect('COUNT(*) FILTER (WHERE e.aprobado = true)', 'aprobados')
        .where('e.alumno_id = :alumnoId', { alumnoId })
        .getRawOne<{ avgScore: string | null; aprobados: string }>(),
      this.anotacionRepository
        .createQueryBuilder('a')
        .select('COUNT(*)', 'total')
        .where('a.alumno_id = :alumnoId', { alumnoId })
        .getRawOne<{ total: string }>(),
    ]);

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
      evalAgg?.avgScore != null && !isNaN(Number(evalAgg.avgScore)) ? Number(evalAgg.avgScore) : 0;

    const actividadFechas = sesiones
      .map((s) => (s.fechaFin ? dateKeyUTC(new Date(s.fechaFin)) : null))
      .filter((x): x is string => !!x);
    const { actual, maxima } = computeStreakUTC(actividadFechas, dateKeyUTC(now));

    const segmentosCompletados = Number(evalAgg?.aprobados || 0);
    const anotacionesTotales = Number(anotacionesCountAgg?.total || 0);
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

