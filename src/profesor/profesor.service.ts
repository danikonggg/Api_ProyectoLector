import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaestroGrupo } from '../escuelas/entities/maestro-grupo.entity';
import { Grupo } from '../escuelas/entities/grupo.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';
import { SesionLectura } from '../alumno/entities/sesion-lectura.entity';

function estadoActividad(ultimaActividad: Date | null): 'active' | 'warning' | 'alert' {
  if (!ultimaActividad) return 'alert';
  const now = Date.now();
  const diffDays = Math.floor((now - new Date(ultimaActividad).getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 1) return 'active';
  if (diffDays <= 4) return 'warning';
  return 'alert';
}

@Injectable()
export class ProfesorService {
  constructor(
    @InjectRepository(MaestroGrupo)
    private readonly maestroGrupoRepository: Repository<MaestroGrupo>,
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(SesionLectura)
    private readonly sesionLecturaRepository: Repository<SesionLectura>,
  ) {}

  async getGrupos(maestroId: number) {
    const asignaciones = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });
    const grupoIds = Array.from(new Set(asignaciones.map((x) => Number(x.grupoId))));
    if (grupoIds.length === 0) return { data: [] };

    const gruposResolved = await this.grupoRepository
      .createQueryBuilder('g')
      .where('g.id IN (:...ids)', { ids: grupoIds })
      .getMany();

    const alumnosAgg = await this.alumnoRepository
      .createQueryBuilder('a')
      .select('a.grupo_id', 'grupoId')
      .addSelect('COUNT(*)', 'total')
      .where('a.grupo_id IN (:...ids)', { ids: grupoIds })
      .andWhere('a.activo = true')
      .groupBy('a.grupo_id')
      .getRawMany<{ grupoId: string; total: string }>();

    const pendientesAgg = await this.alumnoRepository
      .createQueryBuilder('a')
      .select('a.grupo_id', 'grupoId')
      .addSelect('COUNT(*) FILTER (WHERE COALESCE(al.porcentaje,0) < 100)', 'pendientes')
      .leftJoin(AlumnoLibro, 'al', 'al.alumno_id = a.id')
      .where('a.grupo_id IN (:...ids)', { ids: grupoIds })
      .andWhere('a.activo = true')
      .groupBy('a.grupo_id')
      .getRawMany<{ grupoId: string; pendientes: string }>();

    const alumnosMap = new Map<number, number>();
    for (const r of alumnosAgg) alumnosMap.set(Number(r.grupoId), Number(r.total || 0));
    const pendientesMap = new Map<number, number>();
    for (const r of pendientesAgg) pendientesMap.set(Number(r.grupoId), Number(r.pendientes || 0));

    const data = gruposResolved.map((g) => ({
      id: String(g.id),
      nombre: `${g.grado}°${g.nombre}`,
      grado: String(g.grado),
      seccion: g.nombre,
      totalAlumnos: alumnosMap.get(Number(g.id)) ?? 0,
      alumnosPendientesEvaluacion: pendientesMap.get(Number(g.id)) ?? 0,
    }));

    return { data };
  }

  async getAlumnosPorGrupo(maestroId: number, grupoId: number) {
    const permitido = await this.maestroGrupoRepository.findOne({ where: { maestroId, grupoId } });
    if (!permitido) throw new ForbiddenException('No tienes acceso a este grupo.');

    const alumnos = await this.alumnoRepository.find({
      where: { grupoId, activo: true },
      relations: ['persona'],
      select: {
        id: true,
        persona: { nombre: true, apellidoPaterno: true, apellidoMaterno: true },
      } as any,
    });

    if (alumnos.length === 0) return { data: [] };
    const alumnoIds = alumnos.map((a) => Number(a.id));

    const librosAgg = await this.alumnoLibroRepository
      .createQueryBuilder('al')
      .select('al.alumno_id', 'alumnoId')
      .addSelect('AVG(al.porcentaje)', 'progreso')
      .addSelect('COUNT(*)', 'asignados')
      .addSelect('COUNT(*) FILTER (WHERE al.porcentaje >= 100)', 'completados')
      .where('al.alumno_id IN (:...ids)', { ids: alumnoIds })
      .groupBy('al.alumno_id')
      .getRawMany<{ alumnoId: string; progreso: string | null; asignados: string; completados: string }>();

    const ultimaAgg = await this.sesionLecturaRepository
      .createQueryBuilder('s')
      .select('s.alumno_id', 'alumnoId')
      .addSelect('MAX(s.fecha_fin)', 'ultimaActividad')
      .where('s.alumno_id IN (:...ids)', { ids: alumnoIds })
      .groupBy('s.alumno_id')
      .getRawMany<{ alumnoId: string; ultimaActividad: string | null }>();

    const librosMap = new Map<number, { progreso: number; asignados: number; completados: number }>();
    for (const r of librosAgg) {
      librosMap.set(Number(r.alumnoId), {
        progreso: r.progreso != null ? Number(r.progreso) : 0,
        asignados: Number(r.asignados || 0),
        completados: Number(r.completados || 0),
      });
    }

    const ultimaMap = new Map<number, Date | null>();
    for (const r of ultimaAgg) {
      ultimaMap.set(Number(r.alumnoId), r.ultimaActividad ? new Date(r.ultimaActividad) : null);
    }

    const data = alumnos.map((a) => {
      const agg = librosMap.get(Number(a.id)) ?? { progreso: 0, asignados: 0, completados: 0 };
      const ultima = ultimaMap.get(Number(a.id)) ?? null;
      const nombre = [a.persona?.nombre, a.persona?.apellidoPaterno, a.persona?.apellidoMaterno]
        .filter(Boolean)
        .join(' ');
      return {
        alumnoId: String(a.id),
        nombre,
        progresoPromedio: Math.round(agg.progreso),
        ultimaActividad: ultima,
        estadoActividad: estadoActividad(ultima),
        librosAsignados: agg.asignados,
        librosCompletados: agg.completados,
      };
    });

    return { data };
  }
}

