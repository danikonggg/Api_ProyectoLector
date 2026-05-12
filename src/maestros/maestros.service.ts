import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../common/utils/audit.utils';
import { AsignarAlumnoDto } from './dto/asignar-alumno.dto';
import { alumnoPerteneceAGrupos } from '../common/utils/grupo.utils';

@Injectable()
export class MaestrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async obtenerMisAlumnos(maestroId: number) {
    const maestroIdBig = BigInt(maestroId);
    const maestro = await this.prisma.maestro.findUnique({
      where: { id: maestroIdBig },
      include: { escuela: true },
    });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');

    const escuelaId = maestro.escuelaId;
    const maestroGrupos = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: maestroIdBig },
      include: { grupo: true },
    });

    if (maestroGrupos.length === 0) {
      return {
        message: 'Alumnos obtenidos exitosamente',
        description: 'No tienes grupos asignados. El director debe asignarte grupos.',
        total: 0,
        data: [],
      };
    }

    const alumnos = await this.prisma.alumno.findMany({
      where: { escuelaId, activo: true },
      include: { persona: true, escuela: true },
    });

    const filtrados = alumnos.filter((a) => alumnoPerteneceAGrupos(a as any, maestroGrupos as any));

    return {
      message: 'Alumnos obtenidos exitosamente',
      description: `Tienes ${filtrados.length} alumno(s) en tus grupos`,
      total: filtrados.length,
      data: filtrados,
    };
  }

  async obtenerAlumnoPorId(maestroId: number, alumnoId: number) {
    const maestroIdBig = BigInt(maestroId);
    const maestro = await this.prisma.maestro.findUnique({ where: { id: maestroIdBig } });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');

    const alumno = await this.prisma.alumno.findFirst({
      where: { id: BigInt(alumnoId), escuelaId: maestro.escuelaId, activo: true },
      include: { persona: true, escuela: true },
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');

    const maestroGrupos = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: maestroIdBig },
      include: { grupo: true },
    });
    const pertenece = alumnoPerteneceAGrupos(alumno as any, maestroGrupos as any);
    if (!pertenece) throw new NotFoundException('Alumno no encontrado o no pertenece a tus grupos');

    return {
      message: 'Alumno obtenido exitosamente',
      description: 'El alumno pertenece a uno de tus grupos',
      data: alumno,
    };
  }

  async asignarAlumno(maestroId: number, dto: AsignarAlumnoDto, auditContext?: AuditContext) {
    const maestroIdBig = BigInt(maestroId);
    const maestro = await this.prisma.maestro.findUnique({
      where: { id: maestroIdBig },
      include: { escuela: true },
    });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');

    const alumno = await this.prisma.alumno.findUnique({
      where: { id: BigInt(dto.alumnoId) },
      include: { persona: true, escuela: true },
    });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${dto.alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(maestro.escuelaId)) {
      throw new ForbiddenException('Solo puedes asignar alumnos de tu misma escuela');
    }

    const maestroGrupos = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: maestroIdBig },
      include: { grupo: true },
    });
    if (maestroGrupos.length === 0) {
      throw new ForbiddenException('No tienes grupos asignados. El director debe asignarte grupos antes de poder asignar alumnos.');
    }
    if (!alumnoPerteneceAGrupos(alumno as any, maestroGrupos as any)) {
      throw new ForbiddenException('Solo puedes asignar alumnos que pertenezcan a tus grupos');
    }

    const materia = await this.prisma.materia.findUnique({ where: { id: BigInt(dto.materiaId) } });
    if (!materia) throw new NotFoundException(`No se encontró la materia con ID ${dto.materiaId}`);

    const existente = await this.prisma.alumnoMaestro.findFirst({
      where: {
        maestroId: maestroIdBig,
        alumnoId: BigInt(dto.alumnoId),
        materiaId: BigInt(dto.materiaId),
        fechaFin: null,
      },
    });
    if (existente) throw new ConflictException('El alumno ya está asignado a tu clase en esta materia');

    const asignacion = await this.prisma.alumnoMaestro.create({
      data: {
        maestroId: maestroIdBig,
        alumnoId: BigInt(dto.alumnoId),
        materiaId: BigInt(dto.materiaId),
        fechaInicio: new Date(),
        fechaFin: null,
      },
    });

    await this.auditService.log('maestro_asignar_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `maestroId=${maestroId} alumnoId=${dto.alumnoId} materiaId=${dto.materiaId}`,
    });

    return {
      message: 'Alumno asignado exitosamente',
      description: `El alumno ${(alumno.persona as any)?.nombre} ha sido asignado a tu clase de ${materia.nombre}`,
      data: {
        alumnoId: Number(alumno.id),
        materiaId: Number(materia.id),
        materiaNombre: materia.nombre,
        fechaInicio: asignacion.fechaInicio,
      },
    };
  }

  async alumnoPerteneceAGruposDelMaestro(maestroId: number, alumnoId: number): Promise<boolean> {
    const maestroIdBig = BigInt(maestroId);
    const maestro = await this.prisma.maestro.findUnique({ where: { id: maestroIdBig } });
    if (!maestro) return false;
    const alumno = await this.prisma.alumno.findFirst({
      where: { id: BigInt(alumnoId), escuelaId: maestro.escuelaId },
    });
    if (!alumno) return false;
    const maestroGrupos = await this.prisma.maestroGrupo.findMany({
      where: { maestroId: maestroIdBig },
      include: { grupo: true },
    });
    return alumnoPerteneceAGrupos(alumno as any, maestroGrupos as any);
  }

  async desasignarAlumno(maestroId: number, alumnoId: number, materiaId: number, auditContext?: AuditContext) {
    const asignacion = await this.prisma.alumnoMaestro.findFirst({
      where: {
        maestroId: BigInt(maestroId),
        alumnoId: BigInt(alumnoId),
        materiaId: BigInt(materiaId),
        fechaFin: null,
      },
    });
    if (!asignacion) throw new NotFoundException('No se encontró la asignación o el alumno no está en tu clase');

    await this.prisma.alumnoMaestro.update({
      where: { id: asignacion.id },
      data: { fechaFin: new Date() },
    });

    await this.auditService.log('maestro_desasignar_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `maestroId=${maestroId} alumnoId=${alumnoId} materiaId=${materiaId}`,
    });

    return { message: 'Alumno desasignado exitosamente', description: 'El alumno ha sido removido de tu clase' };
  }
}
