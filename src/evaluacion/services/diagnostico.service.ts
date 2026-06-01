import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PerfilAprendizajeService } from './perfil-aprendizaje.service';

export interface PreguntaDiagnosticoParaAlumno {
  preguntaId: number;
  texto: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
}

const PREGUNTAS_DIAGNOSTICO_SEED = [
  {
    textoPregunta:
      "Lee el siguiente fragmento: 'El agua es un recurso esencial para la vida. Sin ella, ningun ser vivo podria sobrevivir.' ¿Cual es la idea principal de este texto?",
    opcionA: 'El agua es un liquido',
    opcionB: 'El agua es fundamental para la vida de todos los seres vivos',
    opcionC: 'Los seres vivos necesitan comer',
    opcionD: 'El agua se encuentra en los rios',
    respuestaCorrecta: 'B',
  },
  {
    textoPregunta:
      "El texto dice: 'Los animales migratorios viajan miles de kilometros cada año en busca de climas mas calidos.' ¿Por que migran estos animales segun el texto?",
    opcionA: 'Para buscar comida en otros continentes',
    opcionB: 'Para huir de sus depredadores',
    opcionC: 'Para encontrar climas mas calidos',
    opcionD: 'Para reproducirse en otros paises',
    respuestaCorrecta: 'C',
  },
  {
    textoPregunta:
      "'La fotosintesis es el proceso por el cual las plantas convierten la luz solar en energia.' ¿Que produce la fotosintesis?",
    opcionA: 'Agua',
    opcionB: 'Oxigeno',
    opcionC: 'Energia a partir de la luz solar',
    opcionD: 'Dioxido de carbono',
    respuestaCorrecta: 'C',
  },
  {
    textoPregunta:
      "Lee: 'Juan llego tarde a la escuela. Afuera llovía a cantaros y habia olvidado su paraguas.' ¿Por que probablemente Juan llego mojado?",
    opcionA: 'Porque cruzo un rio',
    opcionB: 'Porque fue a nadar antes de ir a la escuela',
    opcionC: 'Porque llovia y no tenia paraguas',
    opcionD: 'Porque alguien le lanzo agua',
    respuestaCorrecta: 'C',
  },
  {
    textoPregunta:
      "'El termino 'ecosistema' se refiere al conjunto de seres vivos y su entorno fisico que interactuan entre si.' ¿Que significa 'ecosistema' segun el texto?",
    opcionA: 'Solo los animales de una region',
    opcionB: 'El conjunto de plantas y agua de un lugar',
    opcionC: 'El sistema de rios y montanas',
    opcionD: 'El conjunto de seres vivos y su entorno fisico que interactuan',
    respuestaCorrecta: 'D',
  },
  {
    textoPregunta:
      "El texto menciona: 'Las abejas polinizan las flores, lo cual es esencial para la reproduccion de muchas plantas.' Si las abejas desaparecieran, ¿que pasaria con las plantas segun el texto?",
    opcionA: 'Las plantas crecerian mas rapido',
    opcionB: 'Las plantas no podrian reproducirse correctamente',
    opcionC: 'Las flores se volverian mas coloridas',
    opcionD: 'Las plantas producirian mas frutos',
    respuestaCorrecta: 'B',
  },
  {
    textoPregunta:
      "'La revolucion industrial comenzo en Inglaterra a finales del siglo XVIII.' ¿En que pais comenzo la revolucion industrial?",
    opcionA: 'Francia',
    opcionB: 'Alemania',
    opcionC: 'Estados Unidos',
    opcionD: 'Inglaterra',
    respuestaCorrecta: 'D',
  },
  {
    textoPregunta:
      "Lee: 'Maria estudio toda la noche para su examen de matematicas. Al dia siguiente, cuando vio las calificaciones, sonrio ampliamente.' ¿Como se sentia Maria al ver sus calificaciones?",
    opcionA: 'Triste y decepcionada',
    opcionB: 'Enojada con su maestra',
    opcionC: 'Feliz y satisfecha',
    opcionD: 'Nerviosa y preocupada',
    respuestaCorrecta: 'C',
  },
  {
    textoPregunta:
      "'El texto expone: Los volcanes son formaciones geologicas por donde el magma sale a la superficie. Cuando erupcionan, liberan lava, gases y ceniza.' ¿Que liberan los volcanes cuando erupcionan?",
    opcionA: 'Agua, hielo y nieve',
    opcionB: 'Petroleo, gas y arena',
    opcionC: 'Lava, gases y ceniza',
    opcionD: 'Minerales, rocas y carbon',
    respuestaCorrecta: 'C',
  },
  {
    textoPregunta:
      "'La palabra 'arduo' en la oracion 'Fue un arduo trabajo construir la represa' significa algo que requiere mucho esfuerzo.' ¿Que significa 'arduo' en este contexto?",
    opcionA: 'Rapido y sencillo',
    opcionB: 'Peligroso y arriesgado',
    opcionC: 'Largo y aburrido',
    opcionD: 'Dificil y que requiere mucho esfuerzo',
    respuestaCorrecta: 'D',
  },
];

@Injectable()
export class DiagnosticoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perfilService: PerfilAprendizajeService,
  ) {}

  async necesitaDiagnostico(alumnoId: bigint, libroId: bigint): Promise<boolean> {
    const perfil = await this.perfilService.getPerfil(alumnoId, libroId);
    if (!perfil) return true;
    return !perfil.diagnosticoCompletado;
  }

  async getPreguntasDiagnostico(
    alumnoId: bigint,
    libroId: bigint,
  ): Promise<{
    necesitaDiagnostico: boolean;
    preguntas?: PreguntaDiagnosticoParaAlumno[];
  }> {
    const necesita = await this.necesitaDiagnostico(alumnoId, libroId);
    if (!necesita) {
      return { necesitaDiagnostico: false };
    }

    const grado = await this.obtenerGradoLibro(libroId);
    const todasLasPreguntas = await this.getOrSeedPreguntas();
    // Seleccionar preguntas adaptadas al grado del libro:
    // primaria (1-6) → preguntas más simples (índices 0-5)
    // secundaria (7-9) → preguntas intermedias (índices 2-7)
    // prepa (10+) → preguntas más complejas (índices 4-9)
    const preguntas = this.seleccionarPorGrado(todasLasPreguntas, grado);

    return {
      necesitaDiagnostico: true,
      preguntas: preguntas.map((p) => ({
        preguntaId: Number(p.id),
        texto: p.textoPregunta,
        opcionA: p.opcionA,
        opcionB: p.opcionB,
        opcionC: p.opcionC,
        opcionD: p.opcionD,
      })),
    };
  }

  private async obtenerGradoLibro(libroId: bigint): Promise<number> {
    const libro = await this.prisma.libro.findUnique({
      where: { id: libroId },
      select: { grado: true },
    });
    return Number(libro?.grado ?? 6);
  }

  private seleccionarPorGrado<T>(preguntas: T[], grado: number): T[] {
    if (preguntas.length <= 6) return preguntas;
    if (grado <= 6) return preguntas.slice(0, 6);
    if (grado <= 9) return preguntas.slice(2, 8);
    return preguntas.slice(4, 10);
  }

  async procesarDiagnostico(
    alumnoId: bigint,
    libroId: bigint,
    respuestas: Array<{ preguntaId: number; respuesta: string }>,
  ): Promise<{
    score: number;
    nivelAsignado: 'basico' | 'intermedio' | 'avanzado';
    tiempoMinimo: number;
    perfil: unknown;
  }> {
    const preguntas = await this.getOrSeedPreguntas();
    const correctasMap = new Map(preguntas.map((p) => [Number(p.id), p.respuestaCorrecta]));

    let correctas = 0;
    for (const r of respuestas) {
      const correcta = correctasMap.get(r.preguntaId);
      if (correcta && r.respuesta.toUpperCase() === correcta.toUpperCase()) {
        correctas++;
      }
    }

    const total = preguntas.length;
    const score = total > 0 ? Math.round((correctas / total) * 100) : 0;

    let nivelAsignado: 'basico' | 'intermedio' | 'avanzado';
    let tiempoMinimo: number;

    if (score <= 50) {
      nivelAsignado = 'basico';
      tiempoMinimo = PerfilAprendizajeService.TIEMPO_MIN_BASE['basico'];
    } else if (score <= 79) {
      nivelAsignado = 'intermedio';
      tiempoMinimo = PerfilAprendizajeService.TIEMPO_MIN_BASE['intermedio'];
    } else {
      nivelAsignado = 'avanzado';
      tiempoMinimo = PerfilAprendizajeService.TIEMPO_MIN_BASE['avanzado'];
    }

    // Get or create profile, then update with diagnostic result
    await this.perfilService.getOrCreatePerfil(alumnoId, libroId);

    const perfil = await this.prisma.alumnoPerfilAprendizaje.update({
      where: { alumnoId_libroId: { alumnoId, libroId } },
      data: {
        nivelActual: nivelAsignado,
        tiempoMinimoActual: tiempoMinimo,
        diagnosticoCompletado: true,
        rachaPositiva: 0,
        rachaNegativa: 0,
      },
    });

    return { score, nivelAsignado, tiempoMinimo, perfil };
  }

  private async getOrSeedPreguntas() {
    const activas = await this.prisma.preguntaDiagnostico.findMany({
      where: { activa: true },
      orderBy: { id: 'asc' },
    });

    if (activas.length >= PREGUNTAS_DIAGNOSTICO_SEED.length) return activas;

    // Thread-safe: skipDuplicates evita fallo en concurrencia
    await this.prisma.preguntaDiagnostico.createMany({
      data: PREGUNTAS_DIAGNOSTICO_SEED,
      skipDuplicates: true,
    });

    return this.prisma.preguntaDiagnostico.findMany({
      where: { activa: true },
      orderBy: { id: 'asc' },
    });
  }
}
