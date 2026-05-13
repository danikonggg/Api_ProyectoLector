import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtPersonaLoaderService } from './jwt-persona-loader.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

describe('JwtPersonaLoaderService', () => {
  it('usa dos queries y solo la relación del rol (ej. alumno)', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: BigInt(1), activo: true, tipoPersona: 'alumno' })
      .mockResolvedValueOnce({
        id: BigInt(1),
        tipoPersona: 'alumno',
        correo: 'a@test.com',
        alumno: { id: BigInt(99), personaId: BigInt(1) },
      });

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtPersonaLoaderService,
        { provide: PrismaService, useValue: { persona: { findUnique } } },
        { provide: ConfigService, useValue: { get: () => '0' } },
        {
          provide: RedisService,
          useValue: { enabled: false, raw: null, get: jest.fn(), setex: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    const svc = moduleRef.get(JwtPersonaLoaderService);
    const p = await svc.loadPrincipal(1);

    expect(findUnique).toHaveBeenCalledTimes(2);
    expect((p as any).alumno?.id).toBe(BigInt(99));
  });

  it('falla si usuario no existe en auth row', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(null);
    const del = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtPersonaLoaderService,
        { provide: PrismaService, useValue: { persona: { findUnique } } },
        { provide: ConfigService, useValue: { get: () => '0' } },
        {
          provide: RedisService,
          useValue: { enabled: true, raw: {}, get: jest.fn(), setex: jest.fn(), del },
        },
      ],
    }).compile();

    const svc = moduleRef.get(JwtPersonaLoaderService);
    await expect(svc.loadPrincipal(99)).rejects.toThrow('Usuario no encontrado');
    expect(del).toHaveBeenCalled();
  });

  it('falla si usuario está inactivo', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce({
      id: BigInt(1),
      activo: false,
      tipoPersona: 'alumno',
    });
    const del = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtPersonaLoaderService,
        { provide: PrismaService, useValue: { persona: { findUnique } } },
        { provide: ConfigService, useValue: { get: () => '0' } },
        {
          provide: RedisService,
          useValue: { enabled: true, raw: {}, get: jest.fn(), setex: jest.fn(), del },
        },
      ],
    }).compile();

    const svc = moduleRef.get(JwtPersonaLoaderService);
    await expect(svc.loadPrincipal(1)).rejects.toThrow('Usuario inactivo');
    expect(del).toHaveBeenCalled();
  });
});
