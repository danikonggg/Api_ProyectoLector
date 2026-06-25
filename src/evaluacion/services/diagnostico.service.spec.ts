import { Test } from '@nestjs/testing';
import { DiagnosticoService } from './diagnostico.service';
import { PerfilAprendizajeService } from './perfil-aprendizaje.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * El banco tiene 10 preguntas. Construimos un set de preguntas falsas
 * donde la respuesta correcta de la pregunta i es la letra mapeada.
 */
const LETRAS = ['A', 'B', 'C', 'D'];
const PREGUNTAS = Array.from({ length: 10 }, (_, i) => ({
  id: BigInt(i + 1),
  textoPregunta: `Pregunta ${i + 1}`,
  opcionA: 'a',
  opcionB: 'b',
  opcionC: 'c',
  opcionD: 'd',
  respuestaCorrecta: LETRAS[i % 4],
  activa: true,
}));

function buildPrisma() {
  return {
    preguntaDiagnostico: {
      findMany: jest.fn().mockResolvedValue(PREGUNTAS),
      createMany: jest.fn(),
    },
    libro: { findUnique: jest.fn().mockResolvedValue({ grado: 8 }) },
    alumnoPerfilAprendizaje: {
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
  };
}

async function makeSvc(prisma: any) {
  const perfilService = {
    getPerfil: jest.fn(),
    getOrCreatePerfil: jest.fn().mockResolvedValue({}),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      DiagnosticoService,
      { provide: PrismaService, useValue: prisma },
      { provide: PerfilAprendizajeService, useValue: perfilService },
    ],
  }).compile();
  return { svc: moduleRef.get(DiagnosticoService), prisma };
}

// Respuestas correctas para TODAS las preguntas del banco
const todasCorrectas = PREGUNTAS.map((p) => ({
  preguntaId: Number(p.id),
  respuesta: p.respuestaCorrecta,
}));

describe('DiagnosticoService.procesarDiagnostico', () => {
  it('asigna avanzado con 100% de aciertos sobre el banco completo', async () => {
    const { svc } = await makeSvc(buildPrisma());
    const res = await svc.procesarDiagnostico(BigInt(1), BigInt(7), todasCorrectas);
    expect(res.score).toBe(100);
    expect(res.nivelAsignado).toBe('avanzado');
  });

  it('asigna basico con la mitad o menos de aciertos', async () => {
    const { svc } = await makeSvc(buildPrisma());
    const respuestas = PREGUNTAS.map((p, i) => ({
      preguntaId: Number(p.id),
      // primeras 5 correctas, resto incorrectas
      respuesta: i < 5 ? p.respuestaCorrecta : 'Z',
    }));
    const res = await svc.procesarDiagnostico(BigInt(1), BigInt(7), respuestas);
    expect(res.score).toBe(50);
    expect(res.nivelAsignado).toBe('basico');
  });

  // --- Posible BUG: el alumno solo recibe 6 preguntas (seleccionarPorGrado),
  // pero el score se divide entre el total del banco (10). ---
  it('BUG? el alumno que responde solo las 6 preguntas mostradas nunca llega a avanzado', async () => {
    const prisma = buildPrisma();
    const { svc } = await makeSvc(prisma);

    // simulamos lo que el alumno realmente vio (grado 8 -> slice(2,8) = 6 preguntas)
    const preguntasMostradas = PREGUNTAS.slice(2, 8);
    const respuestas = preguntasMostradas.map((p) => ({
      preguntaId: Number(p.id),
      respuesta: p.respuestaCorrecta,
    }));

    const res = await svc.procesarDiagnostico(BigInt(1), BigInt(7), respuestas);

    // 6 correctas / 10 totales = 60% -> intermedio, jamás avanzado aunque acertó todo
    expect(res.score).toBe(60);
    expect(res.nivelAsignado).toBe('intermedio');
  });
});
