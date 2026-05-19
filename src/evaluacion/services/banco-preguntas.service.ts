import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PreguntasSegmentoService,
  NivelPregunta,
  PreguntaMCQParaAlumno,
} from '../../libros/preguntas-segmento.service';

export interface ValidacionRespuestasResult {
  score: number;
  totalPreguntas: number;
  correctas: number;
  tiposError: Record<string, number>;
}

@Injectable()
export class BancoPreguntasService {
  private static readonly PREGUNTAS_POR_SET = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly preguntasService: PreguntasSegmentoService,
  ) {}

  /**
   * Devuelve un set de preguntas para el alumno, aplicando variacion segun intento.
   * NO incluye respuesta_correcta.
   */
  async getSetPreguntas(
    alumnoId: bigint,
    libroId: bigint,
    segmentoId: bigint,
    nivel: NivelPregunta,
    intento: number,
  ): Promise<PreguntaMCQParaAlumno[]> {
    // Ensure bank exists
    await this.preguntasService.generarYGuardarBancoParaSegmento(segmentoId, libroId);

    // Get all questions for this level
    const todasParaNivel = await this.preguntasService.getPreguntasBancoParaSegmento(
      segmentoId,
      nivel,
    );

    if (todasParaNivel.length === 0) {
      // Fallback: try any level
      const todas = await this.preguntasService.getPreguntasBancoParaSegmento(segmentoId);
      return this.seleccionarYMezclar(todas, intento, alumnoId);
    }

    return this.seleccionarYMezclar(todasParaNivel, intento, alumnoId);
  }

  /**
   * Valida las respuestas del alumno comparandolas con respuesta_correcta en BD.
   * Devuelve score (0-100) y tipos de error.
   */
  async validarRespuestas(
    respuestas: Array<{ preguntaId: number; respuesta: string; tiempoMs?: number }>,
  ): Promise<ValidacionRespuestasResult> {
    const preguntaIds = respuestas.map((r) => BigInt(r.preguntaId));
    const correctasMap = await this.preguntasService.getRespuestasCorrectas(preguntaIds);

    const tiposError: Record<string, number> = {};
    let correctas = 0;

    for (const respuesta of respuestas) {
      const preguntaId = BigInt(respuesta.preguntaId);
      const correcta = correctasMap.get(preguntaId);

      if (!correcta) continue;

      if (respuesta.respuesta.toUpperCase() === correcta.toUpperCase()) {
        correctas++;
      } else {
        // Track error types
        const preguntaInfo = await this.prisma.preguntaSegmento.findUnique({
          where: { id: preguntaId },
          select: { tipo: true },
        });
        const tipo = preguntaInfo?.tipo ?? 'desconocido';
        tiposError[tipo] = (tiposError[tipo] ?? 0) + 1;
      }
    }

    const total = respuestas.length;
    const score = total > 0 ? Math.round((correctas / total) * 100) : 0;

    return { score, totalPreguntas: total, correctas, tiposError };
  }

  private seleccionarYMezclar(
    preguntas: PreguntaMCQParaAlumno[],
    intento: number,
    _alumnoId: bigint,
  ): PreguntaMCQParaAlumno[] {
    if (preguntas.length === 0) return [];

    // On retries, rotate the question pool
    const desplazamiento = (intento - 1) * BancoPreguntasService.PREGUNTAS_POR_SET;
    const rotadas = [
      ...preguntas.slice(desplazamiento % preguntas.length),
      ...preguntas.slice(0, desplazamiento % preguntas.length),
    ];

    const seleccionadas = rotadas.slice(0, BancoPreguntasService.PREGUNTAS_POR_SET);

    // On retries, shuffle option order
    if (intento > 1) {
      return seleccionadas.map((p) => this.mezclarOpciones(p));
    }

    return seleccionadas;
  }

  private mezclarOpciones(pregunta: PreguntaMCQParaAlumno): PreguntaMCQParaAlumno {
    const opciones = [
      pregunta.opcionA,
      pregunta.opcionB,
      pregunta.opcionC,
      pregunta.opcionD,
    ];

    // Simple deterministic shuffle based on preguntaId
    const seed = pregunta.preguntaId % 24;
    const permutaciones = [
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 2, 1, 3],
      [0, 2, 3, 1],
      [0, 3, 1, 2],
      [0, 3, 2, 1],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [1, 2, 0, 3],
      [1, 2, 3, 0],
      [1, 3, 0, 2],
      [1, 3, 2, 0],
      [2, 0, 1, 3],
      [2, 0, 3, 1],
      [2, 1, 0, 3],
      [2, 1, 3, 0],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [3, 0, 1, 2],
      [3, 0, 2, 1],
      [3, 1, 0, 2],
      [3, 1, 2, 0],
      [3, 2, 0, 1],
      [3, 2, 1, 0],
    ];

    const perm = permutaciones[seed] ?? [0, 1, 2, 3];
    const mezcladas = perm.map((i) => opciones[i] ?? '');

    return {
      ...pregunta,
      opcionA: mezcladas[0] ?? '',
      opcionB: mezcladas[1] ?? '',
      opcionC: mezcladas[2] ?? '',
      opcionD: mezcladas[3] ?? '',
    };
  }
}
