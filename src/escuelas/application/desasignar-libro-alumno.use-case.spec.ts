import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DesasignarLibroAlumnoUseCase } from './desasignar-libro-alumno.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

describe('DesasignarLibroAlumnoUseCase', () => {
  let useCase: DesasignarLibroAlumnoUseCase;
  let mockPrisma: {
    alumnoLibro: { findFirst: jest.Mock; delete: jest.Mock };
    alumnoMaestro: { findFirst: jest.Mock };
    maestroGrupo: { findMany: jest.Mock };
  };
  const auditService = { log: jest.fn() };

  beforeEach(async () => {
    mockPrisma = {
      alumnoLibro: { findFirst: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
      alumnoMaestro: { findFirst: jest.fn() },
      maestroGrupo: { findMany: jest.fn() },
    };

    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesasignarLibroAlumnoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    useCase = module.get(DesasignarLibroAlumnoUseCase);
  });

  it('desasigna correctamente para director de su escuela', async () => {
    mockPrisma.alumnoLibro.findFirst.mockResolvedValue({
      id: BigInt(1),
      alumno: { escuelaId: BigInt(7) },
    });

    const result = await useCase.execute(1, 2, {
      escuelaIdRestriccion: 7,
      auditContext: { usuarioId: 99, ip: '127.0.0.1' },
    });

    expect(result.message).toContain('desasignado');
    expect(auditService.log).toHaveBeenCalledWith(
      'director_desasignar_libro',
      expect.objectContaining({ usuarioId: 99 }),
    );
  });

  it('bloquea si la asignación no existe', async () => {
    mockPrisma.alumnoLibro.findFirst.mockResolvedValue(null);
    await expect(useCase.execute(1, 2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bloquea si director intenta operar otra escuela', async () => {
    mockPrisma.alumnoLibro.findFirst.mockResolvedValue({
      id: BigInt(1),
      alumno: { escuelaId: BigInt(8) },
    });
    await expect(useCase.execute(1, 2, { escuelaIdRestriccion: 7 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
