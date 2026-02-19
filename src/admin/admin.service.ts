import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Libro } from '../libros/entities/libro.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
  ) {}

  /**
   * Obtener estadísticas del dashboard para el administrador.
   */
  async getDashboard() {
    const [escuelasActivas, totalEstudiantes, totalProfesores, librosDisponibles] =
      await Promise.all([
        this.escuelaRepository.count(),
        this.alumnoRepository.count(),
        this.maestroRepository.count(),
        this.libroRepository.count({ where: { estado: 'listo' } }),
      ]);

    return {
      message: 'Dashboard obtenido correctamente',
      data: {
        escuelasActivas,
        totalEstudiantes,
        totalProfesores,
        librosDisponibles,
      },
    };
  }
}
