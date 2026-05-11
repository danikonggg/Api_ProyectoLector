import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { Persona } from '../personas/entities/persona.entity';
import { Administrador } from '../personas/entities/administrador.entity';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let personaRepo: { findOne: jest.Mock; update: jest.Mock; save: jest.Mock; create: jest.Mock };
  let adminRepo: { count: jest.Mock; save: jest.Mock; create: jest.Mock };
  let auditLog: jest.Mock;

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
    const save = jest.fn(async (entity) => ({ id: 123, ...entity }));
    const create = jest.fn((dto) => dto);
    personaRepo = { findOne, update, save, create };
    adminRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => ({ id: 77, ...entity })),
    };
    auditLog = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Persona), useValue: personaRepo as unknown as object },
        { provide: getRepositoryToken(Administrador), useValue: adminRepo as unknown as object },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt-token') } },
        { provide: AuditService, useValue: { log: auditLog } },
      ],
    }).compile();

    service = module.get(AuthService);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
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

  it('rechaza password inválido', async () => {
    personaRepo.findOne.mockResolvedValue(mockPersona as Persona);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.login({ email: 'admin@test.com', password: 'bad' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza usuario inactivo', async () => {
    personaRepo.findOne.mockResolvedValue({ ...mockPersona, activo: false } as Persona);
    await expect(service.login({ email: 'admin@test.com', password: '123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza director con escuela inactiva', async () => {
    personaRepo.findOne.mockResolvedValue({
      ...mockPersona,
      tipoPersona: 'director',
      administrador: null,
      director: { activo: true, escuela: { estado: 'inactiva' } },
    } as unknown as Persona);
    await expect(service.login({ email: 'd@test.com', password: '123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('bloquea registrar admin si se alcanzó el máximo', async () => {
    adminRepo.count.mockResolvedValue(5);
    await expect(
      service.registrarAdmin({
        nombre: 'A',
        apellidoPaterno: 'B',
        apellidoMaterno: '',
        email: 'nuevo@t.com',
        password: '123456',
        telefono: null,
        fechaNacimiento: null,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('registra admin correctamente cuando hay cupo', async () => {
    adminRepo.count.mockResolvedValue(1);
    personaRepo.findOne.mockResolvedValue(null);

    const result = await service.registrarAdmin({
      nombre: 'A',
      apellidoPaterno: 'B',
      apellidoMaterno: '',
      email: 'nuevo@t.com',
      password: '123456',
      telefono: null,
      fechaNacimiento: null,
    });

    expect(result.data).toBeDefined();
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalled();
  });
});
