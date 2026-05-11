import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from '../../personas/entities/alumno.entity';
import { EscuelaLibro } from '../../escuelas/entities/escuela-libro.entity';
import { AlumnoLibro } from '../../escuelas/entities/alumno-libro.entity';
import { LicenciaLibro } from '../entities/licencia-libro.entity';

@Injectable()
export class ListarLibrosDisponiblesUseCase {
  constructor(
    @InjectRepository(Alumno)
    private readonly alumnoRepo: Repository<Alumno>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepo: Repository<EscuelaLibro>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepo: Repository<AlumnoLibro>,
    @InjectRepository(LicenciaLibro)
    private readonly licenciaRepo: Repository<LicenciaLibro>,
  ) {}

  async execute(escuelaId: number, alumnoId: number) {
    const alumno = await this.alumnoRepo.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    if (Number(alumno.escuelaId) !== Number(escuelaId)) {
      throw new BadRequestException('El alumno no pertenece a esta escuela.');
    }

    const asignaciones = await this.escuelaLibroRepo.find({
      where: { escuelaId, activo: true },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });

    const yaAsignados = await this.alumnoLibroRepo.find({
      where: { alumnoId },
      select: ['libroId'],
    });
    const idsAsignados = new Set(yaAsignados.map((x) => x.libroId));

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
      return !idsAsignados.has(a.libroId);
    });

    const libroIds = [...new Set(candidatas.map((a) => a.libroId))];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const rows = libroIds.length
      ? await this.licenciaRepo
          .createQueryBuilder('lic')
          .select('lic.libroId', 'libroId')
          .addSelect('COUNT(*)', 'total')
          .where('lic.escuelaId = :escuelaId', { escuelaId })
          .andWhere('lic.libroId IN (:...libroIds)', { libroIds })
          .andWhere('lic.activa = true')
          .andWhere('lic.alumnoId IS NULL')
          .andWhere('lic.fechaVencimiento >= :hoy', { hoy: hoyStr })
          .groupBy('lic.libroId')
          .getRawMany<{ libroId: string; total: string }>()
      : [];

    const libroIdsConLicencia = new Set(
      rows.filter((r) => Number(r.total) > 0).map((r) => Number(r.libroId)),
    );

    const disponibles = candidatas
      .filter((a) => libroIdsConLicencia.has(a.libroId))
      .map((a) => ({
        id: a.libro.id,
        titulo: a.libro.titulo,
        codigo: a.libro.codigo,
        grado: a.libro.grado,
        materia: a.libro.materia?.nombre ?? null,
      }));

    return {
      message: 'Libros disponibles para asignar (con licencias disponibles).',
      total: disponibles.length,
      data: disponibles,
    };
  }
}
