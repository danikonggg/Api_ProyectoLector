import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtPersonaLoaderService } from './jwt-persona-loader.service';
import { Persona } from '../../personas/entities/persona.entity';
import { RedisService } from '../../infra/redis/redis.service';

describe('JwtPersonaLoaderService', () => {
  it('usa dos queries y solo la relación del rol (ej. alumno)', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, activo: true, tipoPersona: 'alumno' })
      .mockResolvedValueOnce({
        id: 1,
        tipoPersona: 'alumno',
        correo: 'a@test.com',
        alumno: { id: 99, personaId: 1 },
      });

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtPersonaLoaderService,
        { provide: getRepositoryToken(Persona), useValue: { findOne } },
        { provide: ConfigService, useValue: { get: () => '0' } },
        {
          provide: RedisService,
          useValue: { enabled: false, raw: null, get: jest.fn(), setex: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    const svc = moduleRef.get(JwtPersonaLoaderService);
    const p = await svc.loadPrincipal(1);

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOne.mock.calls[1][0].relations).toEqual(['alumno']);
    expect((p as Persona).alumno?.id).toBe(99);
  });
});
