/**
 * ============================================
 * SERVICIO: MaestrosService
 * ============================================
 * Permite a los maestros gestionar a sus alumnos (listar, ver, asignar).
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuditContext } from '../common/utils/audit.utils';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Materia } from '../personas/entities/materia.entity';
import { AlumnoMaestro } from '../personas/entities/alumno-maestro.entity';
import { MaestroGrupo } from '../escuelas/entities/maestro-grupo.entity';
import { AsignarAlumnoDto } from './dto/asignar-alumno.dto';
import { alumnoPerteneceAGrupos } from '../common/utils/grupo.utils';

@Injectable()
export class MaestrosService {
  constructor(
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Materia)
    private readonly materiaRepository: Repository<Materia>,
    @InjectRepository(AlumnoMaestro)
    private readonly alumnoMaestroRepository: Repository<AlumnoMaestro>,
    @InjectRepository(MaestroGrupo)
    private readonly maestroGrupoRepository: Repository<MaestroGrupo>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Listar alumnos del maestro (por grupos asignados).
   * Solo muestra alumnos cuyo (grado, grupo) coincide con los grupos del maestro.
   */
  async obtenerMisAlumnos(maestroId: number) {
    const maestro = await this.maestroRepository.findOne({
      where: { id: maestroId },
      relations: ['escuela'],
    });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');

    const escuelaId = Number(maestro.escuelaId);
    const maestroGrupos = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });

    if (maestroGrupos.length === 0) {
      return {
        message: 'Alumnos obtenidos exitosamente',
        description: 'No tienes grupos asignados. El director debe asignarte grupos.',
        total: 0,
        data: [],
      };
    }

    const alumnos = await this.alumnoRepository.find({
      where: { escuelaId, activo: true },
      relations: ['persona', 'escuela'],
    });
    const filtrados = alumnos.filter((a) => alumnoPerteneceAGrupos(a, maestroGrupos));

    const data = filtrados.map((a) => ({
      ...a,
      persona: a.persona,
      escuela: a.escuela,
    }));

    return {
      message: 'Alumnos obtenidos exitosamente',
      description: `Tienes ${data.length} alumno(s) en tus grupos`,
      total: data.length,
      data,
    };
  }

  /**
   * Obtener un alumno por ID. Solo si pertenece a uno de los grupos del maestro.
   */
  async obtenerAlumnoPorId(maestroId: number, alumnoId: number) {
    const maestro = await this.maestroRepository.findOne({
      where: { id: maestroId },
    });
    if (!maestro) throw new NotFoundException('Maestro no encontrado');

    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId, escuelaId: maestro.escuelaId, activo: true },
      relations: ['persona', 'escuela'],
    });
    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado');
    }

    const maestroGrupos = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });
    const pertenece = alumnoPerteneceAGrupos(alumno, maestroGrupos);

    if (!pertenece) {
      throw new NotFoundException(
        'Alumno no encontrado o no pertenece a tus grupos',
      );
    }

    return {
      message: 'Alumno obtenido exitosamente',
      description: 'El alumno pertenece a uno de tus grupos',
      data: alumno,
    };
  }

  /**
   * Asignar un alumno a la clase del maestro (por materia).
   * El alumno debe ser de la misma escuela y pertenecer a uno de los grupos del maestro.
   */
  async asignarAlumno(maestroId: number, dto: AsignarAlumnoDto, auditContext?: AuditContext) {
    const maestro = await this.maestroRepository.findOne({
      where: { id: maestroId },
      relations: ['escuela'],
    });

    if (!maestro) {
      throw new NotFoundException('Maestro no encontrado');
    }

    const alumno = await this.alumnoRepository.findOne({
      where: { id: dto.alumnoId },
      relations: ['persona', 'escuela'],
    });

    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${dto.alumnoId}`);
    }

    if (Number(alumno.escuelaId) !== Number(maestro.escuelaId)) {
      throw new ForbiddenException(
        'Solo puedes asignar alumnos de tu misma escuela',
      );
    }

    const maestroGrupos = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });
    if (maestroGrupos.length === 0) {
      throw new ForbiddenException(
        'No tienes grupos asignados. El director debe asignarte grupos antes de poder asignar alumnos.',
      );
    }
    if (!alumnoPerteneceAGrupos(alumno, maestroGrupos)) {
      throw new ForbiddenException(
        'Solo puedes asignar alumnos que pertenezcan a tus grupos',
      );
    }

    const materia = await this.materiaRepository.findOne({
      where: { id: dto.materiaId },
    });

    if (!materia) {
      throw new NotFoundException(`No se encontró la materia con ID ${dto.materiaId}`);
    }

    const existente = await this.alumnoMaestroRepository.findOne({
      where: {
        maestroId,
        alumnoId: dto.alumnoId,
        materiaId: dto.materiaId,
        fechaFin: IsNull(),
      },
    });

    if (existente) {
      throw new ConflictException(
        'El alumno ya está asignado a tu clase en esta materia',
      );
    }

    const asignacion = this.alumnoMaestroRepository.create({
      maestroId,
      alumnoId: dto.alumnoId,
      materiaId: dto.materiaId,
      fechaInicio: new Date(),
      fechaFin: null,
    });

    await this.alumnoMaestroRepository.save(asignacion);

    await this.auditService.log('maestro_asignar_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `maestroId=${maestroId} alumnoId=${dto.alumnoId} materiaId=${dto.materiaId}`,
    });

    return {
      message: 'Alumno asignado exitosamente',
      description: `El alumno ${alumno.persona?.nombre} ha sido asignado a tu clase de ${materia.nombre}`,
      data: {
        alumnoId: alumno.id,
        materiaId: materia.id,
        materiaNombre: materia.nombre,
        fechaInicio: asignacion.fechaInicio,
      },
    };
  }

  /**
   * Verifica si un alumno pertenece a alguno de los grupos del maestro.
   */
  async alumnoPerteneceAGruposDelMaestro(maestroId: number, alumnoId: number): Promise<boolean> {
    const maestro = await this.maestroRepository.findOne({ where: { id: maestroId } });
    if (!maestro) return false;
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId, escuelaId: maestro.escuelaId },
    });
    if (!alumno) return false;
    const maestroGrupos = await this.maestroGrupoRepository.find({
      where: { maestroId },
      relations: ['grupo'],
    });
    return alumnoPerteneceAGrupos(alumno, maestroGrupos);
  }

  /**
   * Desasignar un alumno de la clase (marcar fecha_fin).
   */
  async desasignarAlumno(maestroId: number, alumnoId: number, materiaId: number, auditContext?: AuditContext) {
    const asignacion = await this.alumnoMaestroRepository.findOne({
      where: {
        maestroId,
        alumnoId,
        materiaId,
        fechaFin: IsNull(),
      },
    });

    if (!asignacion) {
      throw new NotFoundException(
        'No se encontró la asignación o el alumno no está en tu clase',
      );
    }

    asignacion.fechaFin = new Date();
    await this.alumnoMaestroRepository.save(asignacion);

    await this.auditService.log('maestro_desasignar_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `maestroId=${maestroId} alumnoId=${alumnoId} materiaId=${materiaId}`,
    });

    return {
      message: 'Alumno desasignado exitosamente',
      description: 'El alumno ha sido removido de tu clase',
    };
  }
}
