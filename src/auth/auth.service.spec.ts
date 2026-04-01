import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { Persona } from '../personas/entities/persona.entity';
import { Administrador } from '../personas/entities/administrador.entity';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let personaRepo: { findOne: jest.Mock; update: jest.Mock };

  const mockPersona = {
    id: 1,
    correo: 'admin@test.com',
    password: 'hashed',
    nombre: 'Admin',
    apellidoPaterno: 'Test',
    apellidoMaterno: null,
    tipoPersona: 'administrador',
    activo: true,
    administrador: { id: 1 },
    director: null,
    maestro: null,
    alumno: null,
    padre: null,
  };

  beforeEach(async () => {
    const findOne = jest.fn();
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    personaRepo = { findOne, update };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Persona), useValue: personaRepo as unknown as object },
        { provide: getRepositoryToken(Administrador), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt-token') } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('debe lanzar UnauthorizedException si usuario no existe', async () => {
    personaRepo.findOne.mockResolvedValue(null);
    const dto: LoginDto = { email: 'noexiste@test.com', password: '123456' };

    await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('debe retornar token si credenciales son válidas', async () => {
    personaRepo.findOne.mockResolvedValue(mockPersona as Persona);
    const dto: LoginDto = { email: 'admin@test.com', password: '123456' };

    const result = await service.login(dto);

    expect(result.access_token).toBe('jwt-token');
    expect(result.user.email).toBe('admin@test.com');
  });
});
