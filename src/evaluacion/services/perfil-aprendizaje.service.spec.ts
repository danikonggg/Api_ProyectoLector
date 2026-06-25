import { Test } from '@nestjs/testing';
import { PerfilAprendizajeService } from './perfil-aprendizaje.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Tests de la lógica adaptativa del perfil de aprendizaje.
 * Se mockea Prisma: getOrCreatePerfil devuelve el perfil base y update
 * simplemente devuelve los datos que recibe para poder inspeccionarlos.
 */
function buildService(perfilInicial: any) {
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
  const prisma = {
    alumnoPerfilAprendizaje: {
      findUnique: jest.fn().mockResolvedValue(perfilInicial),
      create: jest.fn().mockResolvedValue(perfilInicial),
      update,
    },
  };
  return { prisma, update };
}

async function makeSvc(prisma: any) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PerfilAprendizajeService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return moduleRef.get(PerfilAprendizajeService);
}

const perfilBase = (over: Partial<any> = {}) => ({
  alumnoId: BigInt(1),
  libroId: BigInt(7),
  nivelActual: 'basico',
  tiempoMinimoActual: 360,
  rachaPositiva: 0,
  rachaNegativa: 0,
  diagnosticoCompletado: true,
  ...over,
});

describe('PerfilAprendizajeService (adaptativo)', () => {
  it('NO sube de nivel hasta acumular 3 rachas positivas seguidas', async () => {
    const { prisma, update } = buildService(perfilBase({ rachaPositiva: 2 }));
    const svc = await makeSvc(prisma);

    const res = await svc.aplicarResultadoEvaluacion(BigInt(1), BigInt(7), true, 90);

    // rachaPositiva era 2 -> +1 = 3 -> sube a intermedio y resetea racha
    expect(res.nivelActual).toBe('intermedio');
    expect(res.rachaPositiva).toBe(0);
    expect(res.tiempoMinimoActual).toBe(360 - 20);
    expect(update).toHaveBeenCalled();
  });

  it('aprobar con score < 80 NO cuenta como racha positiva (cuenta como negativa)', async () => {
    const { prisma } = buildService(perfilBase({ rachaPositiva: 2 }));
    const svc = await makeSvc(prisma);

    // aprobadoPrimerIntento=true pero score 75 -> cae en el else
    const res = await svc.aplicarResultadoEvaluacion(BigInt(1), BigInt(7), true, 75);

    expect(res.rachaPositiva).toBe(0);
    expect(res.rachaNegativa).toBe(1);
    expect(res.nivelActual).toBe('basico');
  });

  it('baja de nivel con 2 rachas negativas y aumenta el tiempo mínimo', async () => {
    const { prisma } = buildService(
      perfilBase({ nivelActual: 'intermedio', tiempoMinimoActual: 270, rachaNegativa: 1 }),
    );
    const svc = await makeSvc(prisma);

    const res = await svc.aplicarResultadoEvaluacion(BigInt(1), BigInt(7), false, 40);

    expect(res.nivelActual).toBe('basico');
    expect(res.rachaNegativa).toBe(0);
    expect(res.tiempoMinimoActual).toBe(270 + 30);
  });

  it('no baja de basico (piso) ni sube de avanzado (techo)', async () => {
    const { prisma } = buildService(perfilBase({ nivelActual: 'basico', rachaNegativa: 1 }));
    const svc = await makeSvc(prisma);
    const res = await svc.aplicarResultadoEvaluacion(BigInt(1), BigInt(7), false, 0);
    expect(res.nivelActual).toBe('basico');
  });

  it('respeta el límite inferior de tiempo mínimo (60s)', async () => {
    const { prisma } = buildService(
      perfilBase({ nivelActual: 'intermedio', tiempoMinimoActual: 70, rachaPositiva: 2 }),
    );
    const svc = await makeSvc(prisma);
    const res = await svc.aplicarResultadoEvaluacion(BigInt(1), BigInt(7), true, 100);
    // 70 - 20 = 50, pero el límite es 60
    expect(res.tiempoMinimoActual).toBe(60);
  });
});
