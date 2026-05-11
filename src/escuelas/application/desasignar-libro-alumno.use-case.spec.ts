import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DesasignarLibroAlumnoUseCase } from './desasignar-libro-alumno.use-case';
import { AlumnoLibro } from '../entities/alumno-libro.entity';
import { MaestroGrupo } from '../entities/maestro-grupo.entity';
import { AuditService } from '../../audit/audit.service';

describe('DesasignarLibroAlumnoUseCase', () => {
  let useCase: DesasignarLibroAlumnoUseCase;

  const alumnoLibroRepo = {
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const maestroGrupoRepo = { find: jest.fn() };
  const alumnoMaestroRepo = { findOne: jest.fn() };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(alumnoMaestroRepo),
  };
  const auditService = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesasignarLibroAlumnoUseCase,
        { provide: getRepositoryToken(AlumnoLibro), useValue: alumnoLibroRepo },
        { provide: getRepositoryToken(MaestroGrupo), useValue: maestroGrupoRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    useCase = module.get(DesasignarLibroAlumnoUseCase);
  });

  it('desasigna correctamente para director de su escuela', async () => {
    alumnoLibroRepo.findOne.mockResolvedValue({ alumno: { escuelaId: 7 } });
    alumnoLibroRepo.remove.mockResolvedValue(undefined);

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
    alumnoLibroRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute(1, 2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bloquea si director intenta operar otra escuela', async () => {
    alumnoLibroRepo.findOne.mockResolvedValue({ alumno: { escuelaId: 8 } });
    await expect(useCase.execute(1, 2, { escuelaIdRestriccion: 7 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
