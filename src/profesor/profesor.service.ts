import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { EstadisticasProgresoService } from '../estadisticas/estadisticas-progreso.service';

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
    private readonly prisma: PrismaService,
    private readonly estadisticas: EstadisticasProgresoService,
  ) {}

  /** IDs de los grupos asignados al maestro. */
  private async getGrupoIdsDelMaestro(maestroId: number): Promise<bigint[]> {
    const asignaciones = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: BigInt(maestroId) },
      select: { grupoId: true },
    });
    return Array.from(new Set(asignaciones.map((x) => x.grupoId)));
  }

  /** IDs (bigint) de alumnos activos en los grupos del maestro. */
  private async getAlumnoIdsDelMaestro(maestroId: number): Promise<bigint[]> {
    const grupoIds = await this.getGrupoIdsDelMaestro(maestroId);
    if (grupoIds.length === 0) return [];
    const alumnos = await this.prisma.alumno.findMany({
      where: { grupoId: { in: grupoIds }, activo: true },
      select: { id: true },
    });
    return alumnos.map((a) => a.id);
  }

  /** Lanza 403 si el alumno no pertenece a un grupo del maestro. */
  private async verificarAlumnoDeMisGrupos(maestroId: number, alumnoId: number): Promise<void> {
    const grupoIds = await this.getGrupoIdsDelMaestro(maestroId);
    if (grupoIds.length === 0) {
      throw new ForbiddenException('No tienes grupos asignados.');
    }
    const alumno = await this.prisma.alumno.findFirst({
      where: { id: BigInt(alumnoId), grupoId: { in: grupoIds }, activo: true },
      select: { id: true },
    });
    if (!alumno) {
      throw new ForbiddenException('Este alumno no pertenece a tus grupos.');
    }
  }

  /** #1 — Progreso de un libro con todos los alumnos de los grupos del maestro. */
  async getProgresoLibro(maestroId: number, libroId: number) {
    const alumnoIds = await this.getAlumnoIdsDelMaestro(maestroId);
    return this.estadisticas.progresoLibroPorAlumnos(libroId, alumnoIds);
  }

  /** #2 — Detalle libro por libro de un alumno (validado que sea de sus grupos). */
  async getDetalleAlumnoLibros(maestroId: number, alumnoId: number) {
    await this.verificarAlumnoDeMisGrupos(maestroId, alumnoId);
    return this.estadisticas.detalleLibrosDeAlumno(alumnoId);
  }

  /** #3 — Detalle de evaluaciones de un alumno (validado que sea de sus grupos). */
  async getEvaluacionesAlumno(maestroId: number, alumnoId: number) {
    await this.verificarAlumnoDeMisGrupos(maestroId, alumnoId);
    return this.estadisticas.evaluacionesDeAlumno(alumnoId);
  }

  async getGrupos(maestroId: number) {
    const asignaciones = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: BigInt(maestroId) },
      include: { grupo: true },
    });
    const grupoIds = Array.from(new Set(asignaciones.map((x) => x.grupoId)));
    if (grupoIds.length === 0) return { data: [] };

    const gruposResolved = await this.prisma.grupo.findMany({
      where: { id: { in: grupoIds } },
    });

    const alumnosAgg = await this.prisma.$queryRaw<Array<{ grupoId: bigint; total: bigint }>>`
      SELECT grupo_id as "grupoId", COUNT(*) as total
      FROM "Alumno"
      WHERE grupo_id IN (${Prisma.join(grupoIds)})
        AND activo = true
      GROUP BY grupo_id
    `;

    const pendientesAgg = await this.prisma.$queryRaw<Array<{ grupoId: bigint; pendientes: bigint }>>`
      SELECT a.grupo_id as "grupoId",
             COUNT(*) FILTER (WHERE COALESCE(al.porcentaje, 0) < 100) as pendientes
      FROM "Alumno" a
      LEFT JOIN "Alumno_Libro" al ON al.alumno_id = a.id
      WHERE a.grupo_id IN (${Prisma.join(grupoIds)})
        AND a.activo = true
      GROUP BY a.grupo_id
    `;

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
    const permitido = await this.prisma.maestroGrupo.findFirst({
      where: { maestroId: BigInt(maestroId), grupoId: BigInt(grupoId) },
    });
    if (!permitido) throw new ForbiddenException('No tienes acceso a este grupo.');

    const alumnos = await this.prisma.alumno.findMany({
      where: { grupoId: BigInt(grupoId), activo: true },
      include: { persona: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } } },
    });

    if (alumnos.length === 0) return { data: [] };
    const alumnoIds = alumnos.map((a) => a.id);

    const librosAgg = await this.prisma.$queryRaw<
      Array<{ alumnoId: bigint; progreso: string | null; asignados: bigint; completados: bigint }>
    >`
      SELECT al.alumno_id as "alumnoId",
             AVG(al.porcentaje) as progreso,
             COUNT(*) as asignados,
             COUNT(*) FILTER (WHERE al.porcentaje >= 100) as completados
      FROM "Alumno_Libro" al
      WHERE al.alumno_id IN (${Prisma.join(alumnoIds)})
      GROUP BY al.alumno_id
    `;

    const ultimaAgg = await this.prisma.$queryRaw<
      Array<{ alumnoId: bigint; ultimaActividad: Date | null }>
    >`
      SELECT s.alumno_id as "alumnoId", MAX(s.fecha_fin) as "ultimaActividad"
      FROM "Sesion_Lectura" s
      WHERE s.alumno_id IN (${Prisma.join(alumnoIds)})
      GROUP BY s.alumno_id
    `;

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
