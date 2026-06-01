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

    // Rotar el pool según intento para mostrar preguntas distintas cada vez.
    // NO mezclamos opciones A/B/C/D porque la validación compara contra
    // respuesta_correcta en BD — si se reordena sin actualizar la BD,
    // el alumno que elige la respuesta visualmente correcta sería marcado mal.
    const desplazamiento = (intento - 1) * BancoPreguntasService.PREGUNTAS_POR_SET;
    const rotadas = [
      ...preguntas.slice(desplazamiento % preguntas.length),
      ...preguntas.slice(0, desplazamiento % preguntas.length),
    ];

    return rotadas.slice(0, BancoPreguntasService.PREGUNTAS_POR_SET);
  }
}
