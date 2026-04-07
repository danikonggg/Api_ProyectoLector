import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlumnoLibro } from '../entities/alumno-libro.entity';

/**
 * Caso de uso: libros asignados a un alumno (hexagonal mínimo — el repositorio se inyecta aquí, no en un god service).
 */
@Injectable()
export class ListarLibrosAsignadosAlumnoUseCase {
  constructor(
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
  ) {}

  async execute(alumnoId: number) {
    const asignaciones = await this.alumnoLibroRepository.find({
      where: { alumnoId },
      relations: ['libro', 'libro.materia', 'ultimoSegmento'],
      order: { fechaAsignacion: 'DESC' },
    });

    const data = asignaciones.map((a) => ({
      ...a.libro,
      alumnoLibroId: a.id,
      progreso: a.porcentaje,
      ultimoSegmentoId: a.ultimoSegmentoId,
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
