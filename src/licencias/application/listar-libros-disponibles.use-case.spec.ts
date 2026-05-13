import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ListarLibrosDisponiblesUseCase } from './listar-libros-disponibles.use-case';
import { PrismaService } from '../../prisma/prisma.service';

describe('ListarLibrosDisponiblesUseCase', () => {
  let useCase: ListarLibrosDisponiblesUseCase;
  let mockPrisma: {
    alumno: { findUnique: jest.Mock };
    escuelaLibro: { findMany: jest.Mock };
    alumnoLibro: { findMany: jest.Mock };
    licenciaLibro: { groupBy: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      alumno: { findUnique: jest.fn() },
      escuelaLibro: { findMany: jest.fn() },
      alumnoLibro: { findMany: jest.fn() },
      licenciaLibro: { groupBy: jest.fn() },
    };

    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarLibrosDisponiblesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get(ListarLibrosDisponiblesUseCase);
  });

  it('filtra libros por grado/grupo/asignación y licencias disponibles', async () => {
    mockPrisma.alumno.findUnique.mockResolvedValue({
      id: BigInt(10),
      escuelaId: BigInt(1),
      grado: BigInt(3),
      grupo: 'A',
    });
    mockPrisma.escuelaLibro.findMany.mockResolvedValue([
      {
        libroId: BigInt(100),
        grupo: 'A',
        libro: { id: BigInt(100), titulo: 'Libro A', codigo: 'A', grado: BigInt(3), activo: true, materia: null },
      },
      {
        libroId: BigInt(101),
        grupo: 'B',
        libro: { id: BigInt(101), titulo: 'Libro B', codigo: 'B', grado: BigInt(3), activo: true, materia: null },
      },
    ]);
    mockPrisma.alumnoLibro.findMany.mockResolvedValue([]);
    mockPrisma.licenciaLibro.groupBy.mockResolvedValue([
      { libroId: BigInt(100), _count: { id: 2 } },
    ]);

    const result = await useCase.execute(1, 10);

    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe(100);
  });

  it('lanza error si alumno no existe', async () => {
    mockPrisma.alumno.findUnique.mockResolvedValue(null);
    await expect(useCase.execute(1, 10)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza error si alumno pertenece a otra escuela', async () => {
    mockPrisma.alumno.findUnique.mockResolvedValue({
      id: BigInt(10),
      escuelaId: BigInt(2),
      grado: BigInt(3),
      grupo: 'A',
    });
    await expect(useCase.execute(1, 10)).rejects.toBeInstanceOf(BadRequestException);
  });
});
