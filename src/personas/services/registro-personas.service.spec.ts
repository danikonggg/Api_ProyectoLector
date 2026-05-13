import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RegistroPersonasService } from './registro-personas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { VinculacionPadresService } from './vinculacion-padres.service';

describe('RegistroPersonasService', () => {
  let service: RegistroPersonasService;

  it('evita registrar padre con correo duplicado', async () => {
    const txMock = {
      persona: { findFirst: jest.fn().mockResolvedValue({ id: BigInt(99) }) },
    };

    const prismaMock = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroPersonasService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: VinculacionPadresService,
          useValue: { crearCodigoVinculacionParaAlumnoTransactional: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RegistroPersonasService);

    await expect(
      service.registrarPadre({
        nombre: 'Juan',
        apellidoPaterno: 'Perez',
        email: 'duplicado@test.com',
        password: '123456',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
