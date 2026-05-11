import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlumnoLibro } from '../entities/alumno-libro.entity';
import { LicenciaLibro } from '../../licencias/entities/licencia-libro.entity';

/**
 * Caso de uso: libros asignados a un alumno (hexagonal mínimo — el repositorio se inyecta aquí, no en un god service).
 */
@Injectable()
export class ListarLibrosAsignadosAlumnoUseCase {
  constructor(
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(LicenciaLibro)
    private readonly licenciaLibroRepository: Repository<LicenciaLibro>,
  ) {}

  async execute(alumnoId: number) {
    const asignaciones = await this.alumnoLibroRepository.find({
      where: { alumnoId },
      relations: ['libro', 'libro.materia', 'ultimoSegmento'],
      order: { fechaAsignacion: 'DESC' },
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);
    const conLicenciaVigente = await this.licenciaLibroRepository
      .createQueryBuilder('lic')
      .where('lic.alumnoId = :alumnoId', { alumnoId })
      .andWhere('lic.activa = true')
      .andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoyStr })
      .select(['lic.libroId'])
      .getMany();
    const libroIdsPermitidos = new Set(conLicenciaVigente.map((r) => Number(r.libroId)));

    const visibles = asignaciones.filter((a) => libroIdsPermitidos.has(Number(a.libroId)));

    const data = visibles.map((a) => ({
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
