import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { alumnoPerteneceAGrupos } from '../../common/utils/grupo.utils';
import { AuditService } from '../../audit/audit.service';

export interface DesasignarLibroAuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

export interface DesasignarLibroContext {
  escuelaIdRestriccion?: number;
  maestroId?: number;
  auditContext?: DesasignarLibroAuditContext;
}

@Injectable()
export class DesasignarLibroAlumnoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async execute(alumnoId: number, libroId: number, context?: DesasignarLibroContext) {
    const alumnoIdBig = BigInt(alumnoId);
    const libroIdBig = BigInt(libroId);

    const asignacion = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig },
      include: { alumno: true },
    });
    if (!asignacion) throw new NotFoundException('No se encontró la asignación libro-alumno.');

    if (context?.escuelaIdRestriccion != null) {
      if (Number(asignacion.alumno?.escuelaId) !== context.escuelaIdRestriccion) {
        throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tu escuela.');
      }
    }

    if (context?.maestroId != null) {
      const maestroIdBig = BigInt(context.maestroId);
      const enClase = await this.prisma.alumnoMaestro.findFirst({
        where: { maestroId: maestroIdBig, alumnoId: alumnoIdBig, fechaFin: null },
      });
      if (!enClase) {
        const mgList = await this.prisma.maestroGrupo.findMany({
          where: { maestroId: maestroIdBig },
          include: { grupo: true },
        });
        if (!asignacion.alumno || !alumnoPerteneceAGrupos(asignacion.alumno as any, mgList as any)) {
          throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tus grupos.');
        }
      }
    }

    await this.prisma.alumnoLibro.delete({ where: { id: asignacion.id } });

    const accion =
      context?.escuelaIdRestriccion != null
        ? 'director_desasignar_libro'
        : context?.maestroId != null
          ? 'maestro_desasignar_libro'
          : null;

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
}
