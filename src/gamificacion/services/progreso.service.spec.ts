import { Test } from '@nestjs/testing';
import { ProgresoService } from './progreso.service';
import { PrismaService } from '../../prisma/prisma.service';

const NIVELES = [
  { nivel: 1, nombre: 'N1', puntosMin: 0, puntosMax: 299 },
  { nivel: 2, nombre: 'N2', puntosMin: 300, puntosMax: 599 },
  { nivel: 3, nombre: 'N3', puntosMin: 600, puntosMax: 999 },
];

function prismaCon(progreso: any) {
  return {
    alumnoProgreso: {
      upsert: jest.fn().mockResolvedValue(progreso),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...progreso, ...data }),
      ),
    },
    nivelLector: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(NIVELES.find((n) => n.nivel === where.nivel) ?? null),
        ),
      findFirst: jest.fn(),
    },
  };
}

async function makeSvc(prisma: any) {
  const moduleRef = await Test.createTestingModule({
    providers: [ProgresoService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(ProgresoService);
}

describe('ProgresoService.obtenerProgreso', () => {
  it('calcula porcentajeNivel y puntosParaSiguienteNivel correctamente', async () => {
    const prisma = prismaCon({
      alumnoId: BigInt(42),
      puntosTotales: 450, // nivel 2 (300-599)
      nivelActual: 2,
    });
    const svc = await makeSvc(prisma);
    const p = await svc.obtenerProgreso(42);

    // (450-300)/(599-300+1)*100 = 150/300*100 = 50
    expect(p.porcentajeNivel).toBe(50);
    // siguiente nivel min 600 - 450 = 150
    expect(p.puntosParaSiguienteNivel).toBe(150);
    expect(p.alumnoId).toBe(42);
  });

  it('porcentajeNivel se topa en 100 y no es negativo en el piso del nivel', async () => {
    const prisma = prismaCon({
      alumnoId: BigInt(42),
      puntosTotales: 300, // justo el piso del nivel 2
      nivelActual: 2,
    });
    const svc = await makeSvc(prisma);
    const p = await svc.obtenerProgreso(42);
    expect(p.porcentajeNivel).toBe(0);
  });

  it('en el último nivel puntosParaSiguienteNivel es 0', async () => {
    const prisma = prismaCon({
      alumnoId: BigInt(42),
      puntosTotales: 800,
      nivelActual: 3, // no hay nivel 4
    });
    const svc = await makeSvc(prisma);
    const p = await svc.obtenerProgreso(42);
    expect(p.puntosParaSiguienteNivel).toBe(0);
  });
});
