import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AlumnoLibro } from '../entities/alumno-libro.entity';
import { MaestroGrupo } from '../entities/maestro-grupo.entity';
import { AlumnoMaestro } from '../../personas/entities/alumno-maestro.entity';
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
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(MaestroGrupo)
    private readonly maestroGrupoRepository: Repository<MaestroGrupo>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async execute(alumnoId: number, libroId: number, context?: DesasignarLibroContext) {
    const asignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
      relations: ['alumno'],
    });
    if (!asignacion) {
      throw new NotFoundException('No se encontró la asignación libro-alumno.');
    }

    if (context?.escuelaIdRestriccion != null) {
      if (Number(asignacion.alumno?.escuelaId) !== Number(context.escuelaIdRestriccion)) {
        throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tu escuela.');
      }
    }

    if (context?.maestroId != null) {
      const enClase = await this.dataSource.getRepository(AlumnoMaestro).findOne({
        where: {
          maestroId: context.maestroId,
          alumnoId,
          fechaFin: IsNull(),
        },
      });
      if (!enClase) {
        const mgList = await this.maestroGrupoRepository.find({
          where: { maestroId: context.maestroId },
          relations: ['grupo'],
        });
        if (!asignacion.alumno || !alumnoPerteneceAGrupos(asignacion.alumno, mgList)) {
          throw new ForbiddenException('Solo puedes desasignar libros de alumnos de tus grupos.');
        }
      }
    }

    await this.alumnoLibroRepository.remove(asignacion);
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
