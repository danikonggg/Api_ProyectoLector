/**
 * ============================================
 * SERVICIO: Preguntas por nivel (IA - Groq)
 * ============================================
 * Genera preguntas sobre un segmento de libro según el nivel:
 * - básico: recordar hechos, identificar
 * - intermedio: comprender, aplicar
 * - avanzado: analizar, evaluar
 * Al cargar un libro se generan las 3 niveles para cada segmento y se guardan en BD.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';

export type NivelPregunta = 'basico' | 'intermedio' | 'avanzado';

const NIVELES_VALIDOS: NivelPregunta[] = ['basico', 'intermedio', 'avanzado'];

/** Máximo de segmentos procesados en paralelo para no saturar Groq. */
const CONCURRENCIA_SEGMENTOS = 4;
/** Pausa entre lotes de peticiones paralelas. */
const DELAY_ENTRE_LOTES_MS = 800;
/** Máximo de reintentos ante rate limit (429). */
const MAX_REINTENTOS = 3;
/** Delay base para backoff exponencial (ms). */
const RETRY_DELAY_BASE_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ejecuta tareas con límite de concurrencia y devuelve resultados. */
async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const PROMPT_POR_NIVEL: Record<NivelPregunta, string> = {
  basico:
    'Preguntas de RECUERDO: que el estudiante identifique hechos, fechas, nombres o conceptos explícitos en el texto. Fáciles, respuesta directa.',
  intermedio:
    'Preguntas de COMPRENSIÓN y APLICACIÓN: que el estudiante explique con sus palabras, resuma, compare o aplique lo leído a un ejemplo.',
  avanzado:
    'Preguntas de ANÁLISIS o EVALUACIÓN: que el estudiante analice causas, argumente, critique o relacione ideas con otros conocimientos.',
};

@Injectable()
export class PreguntasSegmentoService {
  private readonly logger = new Logger(PreguntasSegmentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Valida que el nivel sea uno de los permitidos.
   */
  static esNivelValido(nivel: string): nivel is NivelPregunta {
    return NIVELES_VALIDOS.includes(nivel as NivelPregunta);
  }

  /**
   * Genera preguntas para un segmento según el nivel usando Groq.
   */
  async generarPreguntas(
    segmentoId: number,
    nivel: NivelPregunta,
  ): Promise<{
    success: boolean;
    segmentoId: number;
    nivel: NivelPregunta;
    preguntas?: string[];
    error?: string;
  }> {
    const segmento = await this.prisma.segmento.findUnique({
      where: { id: BigInt(segmentoId) },
      select: { id: true, contenido: true },
    });

    if (!segmento) {
      return { success: false, segmentoId, nivel, error: 'Segmento no encontrado.' };
    }

    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      return {
        success: false,
        segmentoId,
        nivel,
        error: 'GROQ_API_KEY no configurada. No se pueden generar preguntas.',
      };
    }

    const instruccion = PROMPT_POR_NIVEL[nivel];
    const contenidoCorto =
      segmento.contenido.length > 2500
        ? segmento.contenido.slice(0, 2500) + '...'
        : segmento.contenido;

    const systemPrompt = `Eres un profesor que crea preguntas de lectura. Dado un fragmento de libro, genera exactamente 3 preguntas según el nivel indicado.
Nivel: ${nivel}. ${instruccion}
Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto extra, con esta forma exacta:
{"preguntas": ["pregunta 1", "pregunta 2", "pregunta 3"]}`;

    const userPrompt = `Fragmento del libro:\n\n${contenidoCorto}`;

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      try {
        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: 'llama-3.1-8b-instant',
          max_tokens: 600,
          temperature: 0.5,
        });

        const raw = chatCompletion.choices[0]?.message?.content?.trim() ?? '';
        const preguntas = this.extraerPreguntasDeJson(raw);

        if (preguntas.length === 0) {
          this.logger.warn(
            `Groq no devolvió preguntas válidas para segmento ${segmentoId}. Raw: ${raw.slice(0, 200)}`,
          );
          return {
            success: false,
            segmentoId,
            nivel,
            error: 'No se pudieron generar preguntas. Intenta de nuevo.',
          };
        }

        this.logger.log(
          `Preguntas generadas: segmento=${segmentoId}, nivel=${nivel}, cantidad=${preguntas.length}`,
        );
        return { success: true, segmentoId, nivel, preguntas };
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err?.status === 429 && intento < MAX_REINTENTOS - 1) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, intento);
          this.logger.warn(
            `Rate limit (429) segmento ${segmentoId}. Reintento ${intento + 2}/${MAX_REINTENTOS} en ${delay}ms`,
          );
          await sleep(delay);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Groq error segmento ${segmentoId}: ${message}`);
          return { success: false, segmentoId, nivel, error: message };
        }
      }
    }
    return { success: false, segmentoId, nivel, error: 'Máximo de reintentos alcanzado.' };
  }

  /**
   * Genera las preguntas para los 3 niveles en UNA sola llamada a Groq (más rápido).
   */
  async generarPreguntas3Niveles(segmentoId: number): Promise<{
    success: boolean;
    basico?: string[];
    intermedio?: string[];
    avanzado?: string[];
    error?: string;
  }> {
    const segmento = await this.prisma.segmento.findUnique({
      where: { id: BigInt(segmentoId) },
      select: { id: true, contenido: true },
    });

    if (!segmento) {
      return { success: false, error: 'Segmento no encontrado.' };
    }

    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      return { success: false, error: 'GROQ_API_KEY no configurada.' };
    }

    const contenidoCorto =
      segmento.contenido.length > 2500
        ? segmento.contenido.slice(0, 2500) + '...'
        : segmento.contenido;

    const systemPrompt = `Eres un profesor que crea preguntas de lectura en 3 niveles. Dado un fragmento, genera exactamente 3 preguntas por nivel (básico, intermedio, avanzado).
Responde ÚNICAMENTE con un JSON válido sin markdown:
{"basico": ["p1","p2","p3"], "intermedio": ["p1","p2","p3"], "avanzado": ["p1","p2","p3"]}`;

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      try {
        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Fragmento:\n\n${contenidoCorto}` },
          ],
          model: 'llama-3.1-8b-instant',
          max_tokens: 1200,
          temperature: 0.5,
        });

        const raw = chatCompletion.choices[0]?.message?.content?.trim() ?? '';
        const resultado = this.extraerPreguntas3NivelesDeJson(raw);
        if (!resultado) {
          return { success: false, error: 'No se pudieron parsear preguntas.' };
        }
        return { success: true, ...resultado };
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err?.status === 429 && intento < MAX_REINTENTOS - 1) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, intento);
          await sleep(delay);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        }
      }
    }
    return { success: false, error: 'Máximo de reintentos alcanzado.' };
  }

  private extraerPreguntas3NivelesDeJson(
    raw: string,
  ): { basico: string[]; intermedio: string[]; avanzado: string[] } | null {
    try {
      let jsonStr = raw;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) jsonStr = raw.slice(start, end);
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      const a = (v: unknown) =>
        Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string' && p.length > 0) : [];
      const basico = a(obj.basico);
      const intermedio = a(obj.intermedio);
      const avanzado = a(obj.avanzado);
      if (basico.length === 0 && intermedio.length === 0 && avanzado.length === 0) return null;
      return { basico, intermedio, avanzado };
    } catch {
      return null;
    }
  }

  /**
   * Genera y guarda preguntas para un segmento (3 niveles en 1 llamada).
   */
  async generarYGuardarPreguntasParaSegmento(
    segmentoId: number,
  ): Promise<{ guardadas: number; errores: number }> {
    const resultado = await this.generarPreguntas3Niveles(segmentoId);
    let guardadas = 0;
    let errores = 0;

    if (!resultado.success) {
      return { guardadas, errores: 3 };
    }

    for (const nivel of NIVELES_VALIDOS) {
      const preguntas = resultado[nivel] ?? [];
      if (preguntas.length > 0) {
        await this.prisma.preguntaSegmento.createMany({
          data: preguntas.map((texto, idx) => ({
            segmentoId: BigInt(segmentoId),
            nivel,
            textoPregunta: texto,
            orden: idx + 1,
          })),
        });
        guardadas += preguntas.length;
      } else {
        errores += 1;
      }
    }
    return { guardadas, errores };
  }

  /**
   * Genera y guarda preguntas para todos los segmentos de un libro.
   */
  async generarPreguntasParaLibro(libroId: number): Promise<void> {
    const segmentos = await this.prisma.segmento.findMany({
      where: { libroId: BigInt(libroId) },
      select: { id: true },
      orderBy: { orden: 'asc' },
    });
    if (segmentos.length === 0) {
      this.logger.log(`Libro ${libroId}: sin segmentos, no se generan preguntas.`);
      return;
    }

    this.logger.log(
      `Libro ${libroId}: generando preguntas para ${segmentos.length} segmentos (paralelo x${CONCURRENCIA_SEGMENTOS}, 1 llamada/segmento)...`,
    );

    const resultados = await runWithLimit(segmentos, CONCURRENCIA_SEGMENTOS, async (seg, i) => {
      if (i > 0) await sleep(DELAY_ENTRE_LOTES_MS);
      this.logger.log(`Libro ${libroId}: segmento ${i + 1}/${segmentos.length} (id=${seg.id})`);
      return this.generarYGuardarPreguntasParaSegmento(Number(seg.id));
    });

    const totalGuardadas = resultados.reduce((a, r) => a + r.guardadas, 0);
    const totalErrores = resultados.reduce((a, r) => a + r.errores, 0);
    this.logger.log(
      `Libro ${libroId}: preguntas listas. Guardadas=${totalGuardadas}, niveles fallidos=${totalErrores}.`,
    );
  }

  /**
   * Obtiene todas las preguntas del libro por segmento (basico, intermedio, avanzado).
   */
  async getPreguntasPorLibro(
    libroId: number,
  ): Promise<Record<number, { basico: string[]; intermedio: string[]; avanzado: string[] }>> {
    const segmentos = await this.prisma.segmento.findMany({
      where: { libroId: BigInt(libroId) },
      select: { id: true },
    });
    const segmentoIds = segmentos.map((s) => s.id);
    if (segmentoIds.length === 0) return {};

    const todas = await this.prisma.preguntaSegmento.findMany({
      where: { segmentoId: { in: segmentoIds } },
      orderBy: [{ segmentoId: 'asc' }, { nivel: 'asc' }, { orden: 'asc' }],
      select: { segmentoId: true, nivel: true, textoPregunta: true },
    });

    const porSegmento: Record<
      number,
      { basico: string[]; intermedio: string[]; avanzado: string[] }
    > = {};
    for (const segId of segmentoIds) {
      porSegmento[Number(segId)] = { basico: [], intermedio: [], avanzado: [] };
    }
    for (const p of todas) {
      const nivel = p.nivel as NivelPregunta;
      const key = Number(p.segmentoId);
      if (porSegmento[key] && NIVELES_VALIDOS.includes(nivel)) {
        porSegmento[key][nivel].push(p.textoPregunta);
      }
    }
    return porSegmento;
  }

  /**
   * Obtiene las preguntas desde BD para un segmento y nivel.
   */
  async getPreguntasDesdeDb(segmentoId: number, nivel: NivelPregunta): Promise<string[]> {
    const filas = await this.prisma.preguntaSegmento.findMany({
      where: { segmentoId: BigInt(segmentoId), nivel },
      orderBy: { orden: 'asc' },
      select: { textoPregunta: true },
    });
    return filas.map((r) => r.textoPregunta);
  }

  /**
   * Obtiene preguntas: primero desde BD; si no hay, genera con Groq y guarda.
   */
  async getPreguntas(
    segmentoId: number,
    nivel: NivelPregunta,
  ): Promise<{
    success: boolean;
    segmentoId: number;
    nivel: NivelPregunta;
    preguntas?: string[];
    error?: string;
  }> {
    const desdeDb = await this.getPreguntasDesdeDb(segmentoId, nivel);
    if (desdeDb.length > 0) {
      return { success: true, segmentoId, nivel, preguntas: desdeDb };
    }
    const generado = await this.generarPreguntas(segmentoId, nivel);
    if (generado.success && generado.preguntas?.length) {
      await this.prisma.preguntaSegmento.createMany({
        data: generado.preguntas.map((texto, idx) => ({
          segmentoId: BigInt(segmentoId),
          nivel,
          textoPregunta: texto,
          orden: idx + 1,
        })),
      });
    }
    return generado;
  }

  private extraerPreguntasDeJson(raw: string): string[] {
    try {
      let jsonStr = raw;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) {
        jsonStr = raw.slice(start, end);
      }
      const obj = JSON.parse(jsonStr) as { preguntas?: unknown };
      if (!Array.isArray(obj.preguntas)) return [];
      return obj.preguntas.filter((p): p is string => typeof p === 'string' && p.length > 0);
    } catch {
      return [];
    }
  }
}
