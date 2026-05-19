import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockPersona = {
    id: BigInt(1),
    correo: 'admin@test.com',
    password: 'hashed',
    nombre: 'Admin',
    apellidoPaterno: 'Test',
    apellidoMaterno: null,
    tipoPersona: 'administrador',
    activo: true,
    administrador: { id: BigInt(1) },
    director: null,
    maestro: null,
    alumno: null,
    padre: null,
  };

  let mockPrisma: {
    persona: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    administrador: { count: jest.Mock; create: jest.Mock };
  };
  let auditLog: jest.Mock;

  beforeEach(async () => {
    mockPrisma = {
      persona: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(mockPersona),
      },
      administrador: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: BigInt(77) }),
      },
    };
    auditLog = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt-token') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'JWT_EXPIRES_IN') return '2d';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '50d';
              if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret-123456789012345678901234';
              return defaultValue;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'jwt-secret-123456789012345678901234567890';
              throw new Error(`Missing config key: ${key}`);
            }),
          },
        },
        { provide: AuditService, useValue: { log: auditLog } },
      ],
    }).compile();

    service = module.get(AuthService);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
  });

  it('debe lanzar UnauthorizedException si usuario no existe', async () => {
    mockPrisma.persona.findFirst.mockResolvedValue(null);
    const dto: LoginDto = { email: 'noexiste@test.com', password: '123456' };

    await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('debe retornar token si credenciales son válidas', async () => {
    mockPrisma.persona.findFirst.mockResolvedValue(mockPersona);
    const dto: LoginDto = { email: 'admin@test.com', password: '123456' };

    const result = await service.login(dto);

    expect(result.access_token).toBe('jwt-token');
    expect(result.user.email).toBe('admin@test.com');
  });

  it('rechaza password inválido', async () => {
    mockPrisma.persona.findFirst.mockResolvedValue(mockPersona);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.login({ email: 'admin@test.com', password: 'bad' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza usuario inactivo', async () => {
    mockPrisma.persona.findFirst.mockResolvedValue({ ...mockPersona, activo: false });
    await expect(service.login({ email: 'admin@test.com', password: '123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza director con escuela inactiva', async () => {
    mockPrisma.persona.findFirst.mockResolvedValue({
      ...mockPersona,
      tipoPersona: 'director',
      administrador: null,
      director: { activo: true, escuela: { estado: 'inactiva' } },
    });
    await expect(service.login({ email: 'd@test.com', password: '123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('bloquea registrar admin si se alcanzó el máximo', async () => {
    mockPrisma.administrador.count.mockResolvedValue(5);
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
    mockPrisma.administrador.count.mockResolvedValue(1);
    mockPrisma.persona.findFirst.mockResolvedValue(null);
    mockPrisma.persona.create.mockResolvedValue({ ...mockPersona, id: BigInt(123) });

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
