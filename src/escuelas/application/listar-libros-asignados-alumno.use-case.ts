import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ListarLibrosAsignadosAlumnoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(alumnoId: number) {
    const alumnoIdBig = BigInt(alumnoId);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [asignaciones, licenciasVigentes] = await Promise.all([
      this.prisma.alumnoLibro.findMany({
        where: { alumnoId: alumnoIdBig },
        include: {
          libro: { include: { materia: true } },
          ultimoSegmento: true,
        },
        orderBy: { fechaAsignacion: 'desc' },
      }),
      this.prisma.licenciaLibro.findMany({
        where: {
          alumnoId: alumnoIdBig,
          activa: true,
          fechaVencimiento: { gte: hoy },
        },
        select: { libroId: true },
      }),
    ]);

    const libroIdsPermitidos = new Set(licenciasVigentes.map((r) => Number(r.libroId)));
    const visibles = asignaciones.filter((a) => libroIdsPermitidos.has(Number(a.libroId)));

    const data = visibles.map((a) => ({
      ...a.libro,
      alumnoLibroId: Number(a.id),
      progreso: a.porcentaje,
      ultimoSegmentoId: a.ultimoSegmentoId != null ? Number(a.ultimoSegmentoId) : null,
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
}
