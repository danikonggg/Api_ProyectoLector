import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';

@Injectable()
export class DirectorService {
  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepository: Repository<EscuelaLibro>,
  ) {}

  /**
   * Obtener dashboard del director con datos de su escuela.
   */
  async getDashboard(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
      select: ['id', 'nombre', 'nivel', 'clave', 'direccion', 'telefono'],
    });

    if (!escuela) {
      throw new NotFoundException('No se encontró la escuela del director');
    }

    const [totalEstudiantes, totalProfesores, librosDisponibles] =
      await Promise.all([
        this.alumnoRepository.count({ where: { escuelaId } }),
        this.maestroRepository.count({ where: { escuelaId } }),
        this.escuelaLibroRepository.count({
          where: { escuelaId, activo: true },
        }),
      ]);

    return {
      message: 'Dashboard obtenido correctamente',
      data: {
        escuela: {
          id: escuela.id,
          nombre: escuela.nombre,
          nivel: escuela.nivel,
          clave: escuela.clave,
          direccion: escuela.direccion,
          telefono: escuela.telefono,
        },
        totalEstudiantes,
        totalProfesores,
        librosDisponibles,
      },
    };
  }
}
