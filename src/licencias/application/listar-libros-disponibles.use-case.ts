import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ListarLibrosDisponiblesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(escuelaId: number, alumnoId: number) {
    const alumno = await this.prisma.alumno.findUnique({ where: { id: BigInt(alumnoId) } });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new BadRequestException('El alumno no pertenece a esta escuela.');
    }

    const asignaciones = await this.prisma.escuelaLibro.findMany({
      where: { escuelaId: BigInt(escuelaId), activo: true },
      include: { libro: { include: { materia: true } } },
      orderBy: { fechaInicio: 'desc' },
    });

    const yaAsignados = await this.prisma.alumnoLibro.findMany({
      where: { alumnoId: BigInt(alumnoId) },
      select: { libroId: true },
    });
    const idsAsignados = new Set(yaAsignados.map((x) => Number(x.libroId)));

    const candidatas = asignaciones.filter((a) => {
      if (!a.libro || a.libro.activo === false) return false;
      if (Number(a.libro.grado) !== Number(alumno.grado)) return false;
      if (
        a.grupo != null &&
        (alumno.grupo == null ||
          (alumno.grupo || '').trim().toUpperCase() !== (a.grupo || '').trim().toUpperCase())
      ) {
        return false;
      }
      return !idsAsignados.has(Number(a.libroId));
    });

    const libroIds = [...new Set(candidatas.map((a) => Number(a.libroId)))];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const porLibro = libroIds.length
      ? await this.prisma.licenciaLibro.groupBy({
          by: ['libroId'],
          where: {
            escuelaId: BigInt(escuelaId),
            libroId: { in: libroIds.map(BigInt) },
            activa: true,
            alumnoId: null,
            fechaVencimiento: { gte: hoy },
          },
          _count: { libroId: true },
        })
      : [];

    const libroIdsConLicencia = new Set(
      porLibro.filter((r) => r._count.libroId > 0).map((r) => Number(r.libroId)),
    );

    const disponibles = candidatas
      .filter((a) => libroIdsConLicencia.has(Number(a.libroId)))
      .map((a) => ({
        id: Number(a.libro!.id),
        titulo: a.libro!.titulo,
        codigo: a.libro!.codigo,
        grado: Number(a.libro!.grado),
        materia: a.libro!.materia?.nombre ?? null,
      }));

    return {
      message: 'Libros disponibles para asignar (con licencias disponibles).',
      total: disponibles.length,
      data: disponibles,
    };
  }
}
