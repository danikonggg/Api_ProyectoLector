import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ListarLibrosDisponiblesUseCase } from './listar-libros-disponibles.use-case';
import { Alumno } from '../../personas/entities/alumno.entity';
import { EscuelaLibro } from '../../escuelas/entities/escuela-libro.entity';
import { AlumnoLibro } from '../../escuelas/entities/alumno-libro.entity';
import { LicenciaLibro } from '../entities/licencia-libro.entity';

describe('ListarLibrosDisponiblesUseCase', () => {
  let useCase: ListarLibrosDisponiblesUseCase;

  const alumnoRepo = { findOne: jest.fn() };
  const escuelaLibroRepo = { find: jest.fn() };
  const alumnoLibroRepo = { find: jest.fn() };
  const licenciaQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const licenciaRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(licenciaQb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarLibrosDisponiblesUseCase,
        { provide: getRepositoryToken(Alumno), useValue: alumnoRepo },
        { provide: getRepositoryToken(EscuelaLibro), useValue: escuelaLibroRepo },
        { provide: getRepositoryToken(AlumnoLibro), useValue: alumnoLibroRepo },
        { provide: getRepositoryToken(LicenciaLibro), useValue: licenciaRepo },
      ],
    }).compile();

    useCase = module.get(ListarLibrosDisponiblesUseCase);
  });

  it('filtra libros por grado/grupo/asignación y licencias disponibles', async () => {
    alumnoRepo.findOne.mockResolvedValue({ id: 10, escuelaId: 1, grado: 3, grupo: 'A' });
    escuelaLibroRepo.find.mockResolvedValue([
      {
        libroId: 100,
        grupo: 'A',
        libro: { id: 100, titulo: 'Libro A', codigo: 'A', grado: 3, activo: true, materia: null },
      },
      {
        libroId: 101,
        grupo: 'B',
        libro: { id: 101, titulo: 'Libro B', codigo: 'B', grado: 3, activo: true, materia: null },
      },
    ]);
    alumnoLibroRepo.find.mockResolvedValue([]);
    licenciaQb.getRawMany.mockResolvedValue([{ libroId: '100', total: '2' }]);

    const result = await useCase.execute(1, 10);

    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe(100);
  });

  it('lanza error si alumno no existe', async () => {
    alumnoRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute(1, 10)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza error si alumno pertenece a otra escuela', async () => {
    alumnoRepo.findOne.mockResolvedValue({ id: 10, escuelaId: 2, grado: 3, grupo: 'A' });
    await expect(useCase.execute(1, 10)).rejects.toBeInstanceOf(BadRequestException);
  });
});
