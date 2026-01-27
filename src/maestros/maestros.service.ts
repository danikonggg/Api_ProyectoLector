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
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Materia } from '../personas/entities/materia.entity';
import { AlumnoMaestro } from '../personas/entities/alumno-maestro.entity';
import { AsignarAlumnoDto } from './dto/asignar-alumno.dto';

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
  ) {}

  /**
   * Listar alumnos asignados al maestro (vía Alumno_Maestro).
   */
  async obtenerMisAlumnos(maestroId: number) {
    const asignaciones = await this.alumnoMaestroRepository.find({
      where: {
        maestroId,
        fechaFin: IsNull(),
      },
      relations: ['alumno', 'alumno.persona', 'alumno.escuela', 'materia'],
      order: { fechaInicio: 'DESC' },
    });

    const alumnos = asignaciones.map((a) => ({
      ...a.alumno,
      persona: a.alumno.persona,
      escuela: a.alumno.escuela,
      materiaAsignada: a.materia,
      fechaAsignacion: a.fechaInicio,
    }));

    return {
      message: 'Alumnos obtenidos exitosamente',
      description: `Tienes ${alumnos.length} alumno(s) asignado(s)`,
      total: alumnos.length,
      data: alumnos,
    };
  }

  /**
   * Obtener un alumno por ID. Solo si está asignado a este maestro.
   */
  async obtenerAlumnoPorId(maestroId: number, alumnoId: number) {
    const asignacion = await this.alumnoMaestroRepository.findOne({
      where: {
        maestroId,
        alumnoId,
        fechaFin: IsNull(),
      },
      relations: ['alumno', 'alumno.persona', 'alumno.escuela', 'materia'],
    });

    if (!asignacion) {
      throw new NotFoundException(
        'Alumno no encontrado o no está asignado a tu clase',
      );
    }

    const alumno = asignacion.alumno as any;
    alumno.materiaAsignada = asignacion.materia;
    alumno.fechaAsignacion = asignacion.fechaInicio;

    return {
      message: 'Alumno obtenido exitosamente',
      description: 'El alumno está asignado a tu clase',
      data: alumno,
    };
  }

  /**
   * Asignar un alumno a la clase del maestro (por materia).
   * El alumno debe ser de la misma escuela que el maestro.
   */
  async asignarAlumno(maestroId: number, dto: AsignarAlumnoDto) {
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

    if (alumno.escuelaId !== maestro.escuelaId) {
      throw new ForbiddenException(
        'Solo puedes asignar alumnos de tu misma escuela',
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
   * Desasignar un alumno de la clase (marcar fecha_fin).
   */
  async desasignarAlumno(maestroId: number, alumnoId: number, materiaId: number) {
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

    return {
      message: 'Alumno desasignado exitosamente',
      description: 'El alumno ha sido removido de tu clase',
    };
  }
}
