import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RegistroPersonasService } from './registro-personas.service';
import { AuditService } from '../../audit/audit.service';
import { VinculacionPadresService } from './vinculacion-padres.service';

describe('RegistroPersonasService', () => {
  let service: RegistroPersonasService;

  it('evita registrar padre con correo duplicado', async () => {
    const personaRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 99 }),
    };

    const managerMock = {
      getRepository: jest.fn().mockReturnValue(personaRepo),
    };

    const dataSourceMock = {
      transaction: jest.fn(async (cb: (manager: any) => Promise<unknown>) => cb(managerMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroPersonasService,
        { provide: DataSource, useValue: dataSourceMock },
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
