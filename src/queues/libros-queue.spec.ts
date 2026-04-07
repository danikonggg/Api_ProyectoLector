import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { LibrosImportProcessor } from './libros-import.processor';
import { LibroProcesamientoService } from '../libros/libro-procesamiento.service';
import { Libro } from '../libros/entities/libro.entity';
import { RedisService } from '../infra/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { LIBRO_ESTADO } from '../libros/constants/libro-estado.constants';

describe('LibrosImportProcessor', () => {
  it('omite si el libro ya está listo (idempotencia)', async () => {
    const procesar = jest.fn();
    const auditLog = jest.fn();
    const findOne = jest.fn().mockResolvedValue({
      id: 1,
      estado: LIBRO_ESTADO.LISTO,
      unidades: [{ id: 1 }],
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        LibrosImportProcessor,
        {
          provide: LibroProcesamientoService,
          useValue: { procesar, marcarError: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: {
            enabled: true,
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Libro), useValue: { findOne } },
        { provide: AuditService, useValue: { log: auditLog } },
      ],
    }).compile();

    const proc = moduleRef.get(LibrosImportProcessor);
    const job = {
      id: 'job-1',
      data: {
        libroId: 1,
        codigo: 'X',
        rutaPdfRelativa: 'pdfs/x_1.pdf',
      },
    } as Job;

    await proc.process(job);

    expect(procesar).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('si no hay lock, el job falla (reintento Bull) en lugar de completar en silencio', async () => {
    const procesar = jest.fn();
    const findOne = jest.fn().mockResolvedValue({
      id: 1,
      estado: LIBRO_ESTADO.PROCESANDO,
      unidades: [],
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        LibrosImportProcessor,
        {
          provide: LibroProcesamientoService,
          useValue: { procesar, marcarError: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: {
            enabled: true,
            acquireLock: jest.fn().mockResolvedValue(false),
            releaseLock: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Libro), useValue: { findOne } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    const proc = moduleRef.get(LibrosImportProcessor);
    const job = {
      id: 'job-2',
      data: {
        libroId: 1,
        codigo: 'X',
        rutaPdfRelativa: 'pdfs/x_1.pdf',
      },
    } as Job;

    await expect(proc.process(job)).rejects.toThrow(/lock not acquired/);
    expect(procesar).not.toHaveBeenCalled();
  });
});
