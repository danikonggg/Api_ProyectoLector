/**
 * ============================================
 * SERVICIO: Preguntas por nivel (IA - Groq) - Fase 4
 * ============================================
 * Genera 8 preguntas MCQ (opcion_a/b/c/d + respuesta_correcta) sobre un segmento,
 * distribuidas por nivel (basico/intermedio/avanzado) y tipo
 * (vocabulario, idea_principal, inferencia, detalle).
 * Tambien genera pistaContextual y resumen del segmento en la misma llamada.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';

export type NivelPregunta = 'basico' | 'intermedio' | 'avanzado';
export type TipoPregunta = 'vocabulario' | 'idea_principal' | 'inferencia' | 'detalle';

const NIVELES_VALIDOS: NivelPregunta[] = ['basico', 'intermedio', 'avanzado'];

/** Maximo de segmentos procesados en paralelo para no saturar Groq. */
const CONCURRENCIA_SEGMENTOS = 3;
/** Pausa entre lotes de peticiones paralelas. */
const DELAY_ENTRE_LOTES_MS = 1200;
/** Maximo de reintentos ante rate limit (429). */
const MAX_REINTENTOS = 3;
/** Delay base para backoff exponencial (ms). */
const RETRY_DELAY_BASE_MS = 2500;
/** Modelo preferido (mejor calidad, disponible en free tier de Groq). */
const MODELO_PRIMARIO = 'llama-3.3-70b-versatile';
/** Modelo fallback si el primario está saturado. */
const MODELO_FALLBACK = 'llama-3.1-8b-instant';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ejecuta tareas con limite de concurrencia y devuelve resultados. */
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

export interface PreguntaMCQ {
  id: bigint;
  texto: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  nivel: NivelPregunta;
  tipo: TipoPregunta;
}

export interface PreguntaMCQParaAlumno {
  preguntaId: number;
  texto: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  nivel: NivelPregunta;
  tipo: TipoPregunta;
}

interface PreguntaGroqRaw {
  texto: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: string;
  nivel: string;
  tipo: string;
}

interface GroqBancoResponse {
  preguntas: PreguntaGroqRaw[];
  pista_contextual: string;
  resumen: string;
}

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
   * Genera el banco de preguntas MCQ para un segmento usando Groq.
   * Lazy: si ya existen preguntas MCQ en BD, las devuelve sin llamar a Groq.
   */
  async generarYGuardarBancoParaSegmento(
    segmentoId: bigint,
    libroId: bigint,
  ): Promise<PreguntaMCQ[]> {
    // Check if bank already exists
    const existentes = await this.prisma.preguntaSegmento.findMany({
      where: { segmentoId, opcionA: { not: null } },
      orderBy: { orden: 'asc' },
    });

    if (existentes.length > 0) {
      return existentes.map((p) => ({
        id: p.id,
        texto: p.textoPregunta,
        opcionA: p.opcionA ?? '',
        opcionB: p.opcionB ?? '',
        opcionC: p.opcionC ?? '',
        opcionD: p.opcionD ?? '',
        nivel: p.nivel as NivelPregunta,
        tipo: (p.tipo ?? 'detalle') as TipoPregunta,
      }));
    }

    const segmento = await this.prisma.segmento.findUnique({
      where: { id: segmentoId },
      select: {
        id: true,
        contenido: true,
        unidad: {
          select: {
            nombre: true,
            libro: { select: { titulo: true, grado: true } },
          },
        },
      },
    });

    if (!segmento) {
      throw new Error(`Segmento ${segmentoId} no encontrado.`);
    }

    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY no configurada. No se pueden generar preguntas.');
    }

    const tituloLibro = segmento.unidad?.libro?.titulo ?? 'libro de lectura';
    const capituloNombre = segmento.unidad?.nombre ?? '';
    const grado = Number(segmento.unidad?.libro?.grado ?? 6);
    const nivelEscolar = this.describirNivelEscolar(grado);

    const contenidoCorto =
      segmento.contenido.length > 3500
        ? segmento.contenido.slice(0, 3500) + '...'
        : segmento.contenido;

    const contextoLibro = [
      `Libro: "${tituloLibro}"`,
      capituloNombre ? `Capítulo/Sección: "${capituloNombre}"` : '',
      `Nivel educativo del alumno: ${nivelEscolar} (grado ${grado})`,
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `Eres un profesor experto en comprensión lectora para alumnos de educación básica en México.
Tu tarea es generar exactamente 8 preguntas de opción múltiple (MCQ) sobre el fragmento dado, siguiendo estas reglas pedagógicas:

CONTEXTO DEL LIBRO:
${contextoLibro}

REGLAS DE DISTRIBUCIÓN:
- Exactamente 3 preguntas de nivel "basico", 3 de "intermedio", 2 de "avanzado".
- Los tipos "vocabulario", "idea_principal", "inferencia" y "detalle" deben aparecer al menos una vez cada uno.

REGLAS DE CALIDAD (MUY IMPORTANTE):
- Cada pregunta debe estar directamente basada en el fragmento proporcionado, no en conocimiento general.
- Las preguntas deben ser claras, sin ambigüedad y con una sola respuesta correcta.
- Las opciones incorrectas deben ser plausibles pero claramente erróneas si se leyó el texto.
- NO hagas preguntas triviales como "¿De qué trata el texto?" ni preguntas cuya respuesta no esté en el fragmento.
- Adapta el vocabulario y complejidad al nivel del alumno (${nivelEscolar}, grado ${grado}).

DEFINICIÓN DE NIVELES:
- basico: Identificar datos explícitos, vocabulario directo, hechos mencionados literalmente en el texto.
- intermedio: Comprender la idea principal, parafrasear, relacionar ideas dentro del texto, aplicar lo leído.
- avanzado: Inferir, analizar causas y consecuencias, evaluar la postura del autor, relacionar con la vida real.

Genera también:
- pista_contextual: una pregunta reflexiva de 1-2 oraciones que motive al alumno a releer con más atención.
- resumen: 2-3 oraciones que capturen lo esencial del fragmento en lenguaje accesible para el alumno.

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{
  "preguntas": [
    {
      "texto": "...",
      "opcion_a": "...",
      "opcion_b": "...",
      "opcion_c": "...",
      "opcion_d": "...",
      "respuesta_correcta": "B",
      "nivel": "basico",
      "tipo": "idea_principal"
    }
  ],
  "pista_contextual": "...",
  "resumen": "..."
}`;

    const userPrompt = `Fragmento del libro "${tituloLibro}"${capituloNombre ? ` — ${capituloNombre}` : ''}:\n\n${contenidoCorto}`;

    let bancoGroq: GroqBancoResponse | null = null;

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const modeloActual = intento === 0 ? MODELO_PRIMARIO : MODELO_FALLBACK;
      try {
        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: modeloActual,
          max_tokens: 2800,
          temperature: 0.4,
        });

        const raw = chatCompletion.choices[0]?.message?.content?.trim() ?? '';
        bancoGroq = this.parsearBancoGroq(raw);

        if (!bancoGroq || bancoGroq.preguntas.length === 0) {
          this.logger.warn(
            `Groq no devolvio preguntas MCQ validas para segmento ${segmentoId}. Raw: ${raw.slice(0, 300)}`,
          );
          throw new Error('No se pudieron parsear preguntas del response de Groq.');
        }
        this.logger.log(`Preguntas generadas con ${modeloActual} para segmento ${segmentoId}`);
        break;
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err?.status === 429 && intento < MAX_REINTENTOS - 1) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, intento);
          this.logger.warn(
            `Rate limit (429) segmento ${segmentoId} con ${modeloActual}. Reintento ${intento + 2}/${MAX_REINTENTOS} en ${delay}ms`,
          );
          await sleep(delay);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Groq error segmento ${segmentoId} (${modeloActual}): ${message}`);
          if (intento === MAX_REINTENTOS - 1) throw error;
        }
      }
    }

    if (!bancoGroq) {
      throw new Error('Maximo de reintentos alcanzado al generar preguntas MCQ.');
    }

    // Save questions to DB
    const dataPreguntas = bancoGroq.preguntas.map((p, idx) => ({
      segmentoId,
      libroId,
      nivel: p.nivel,
      textoPregunta: p.texto,
      orden: idx + 1,
      opcionA: p.opcion_a,
      opcionB: p.opcion_b,
      opcionC: p.opcion_c,
      opcionD: p.opcion_d,
      respuestaCorrecta: p.respuesta_correcta.toUpperCase(),
      tipo: p.tipo,
    }));

    await this.prisma.preguntaSegmento.createMany({ data: dataPreguntas });

    // Save pista_contextual and resumen to Segmento
    await this.prisma.segmento.update({
      where: { id: segmentoId },
      data: {
        pistaContextual: bancoGroq.pista_contextual,
        resumen: bancoGroq.resumen,
      },
    });

    this.logger.log(
      `Banco MCQ generado: segmento=${segmentoId}, preguntas=${bancoGroq.preguntas.length}`,
    );

    // Return saved questions
    const guardadas = await this.prisma.preguntaSegmento.findMany({
      where: { segmentoId, opcionA: { not: null } },
      orderBy: { orden: 'asc' },
    });

    return guardadas.map((p) => ({
      id: p.id,
      texto: p.textoPregunta,
      opcionA: p.opcionA ?? '',
      opcionB: p.opcionB ?? '',
      opcionC: p.opcionC ?? '',
      opcionD: p.opcionD ?? '',
      nivel: p.nivel as NivelPregunta,
      tipo: (p.tipo ?? 'detalle') as TipoPregunta,
    }));
  }

  /**
   * Obtiene preguntas del banco desde BD para un segmento, opcionalmente filtradas por nivel.
   * NO incluye respuesta_correcta.
   */
  async getPreguntasBancoParaSegmento(
    segmentoId: bigint,
    nivel?: NivelPregunta,
  ): Promise<PreguntaMCQParaAlumno[]> {
    const where: Record<string, unknown> = { segmentoId, opcionA: { not: null } };
    if (nivel) where['nivel'] = nivel;

    const preguntas = await this.prisma.preguntaSegmento.findMany({
      where,
      orderBy: { orden: 'asc' },
    });

    return preguntas.map((p) => ({
      preguntaId: Number(p.id),
      texto: p.textoPregunta,
      opcionA: p.opcionA ?? '',
      opcionB: p.opcionB ?? '',
      opcionC: p.opcionC ?? '',
      opcionD: p.opcionD ?? '',
      nivel: p.nivel as NivelPregunta,
      tipo: (p.tipo ?? 'detalle') as TipoPregunta,
    }));
  }

  /**
   * Obtiene las respuestas correctas para una lista de preguntaIds.
   * Solo para uso interno (no exponer al frontend).
   */
  async getRespuestasCorrectas(
    preguntaIds: bigint[],
  ): Promise<Map<bigint, string>> {
    const preguntas = await this.prisma.preguntaSegmento.findMany({
      where: { id: { in: preguntaIds } },
      select: { id: true, respuestaCorrecta: true },
    });
    const map = new Map<bigint, string>();
    for (const p of preguntas) {
      if (p.respuestaCorrecta) map.set(p.id, p.respuestaCorrecta);
    }
    return map;
  }

  // ──────────────────────────────────────────────
  // Legacy methods (kept for backward compatibility)
  // ──────────────────────────────────────────────

  /**
   * @deprecated Use generarYGuardarBancoParaSegmento instead
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
    const desdeDb = await this.getPreguntasDesdeDb(segmentoId, nivel);
    if (desdeDb.length > 0) {
      return { success: true, segmentoId, nivel, preguntas: desdeDb };
    }
    return { success: false, segmentoId, nivel, error: 'Sin preguntas generadas.' };
  }

  /**
   * @deprecated Use getPreguntasBancoParaSegmento instead
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
   * @deprecated Use generarYGuardarBancoParaSegmento instead
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
    return { success: false, segmentoId, nivel, preguntas: [], error: 'Sin preguntas en BD.' };
  }

  /**
   * Genera y guarda preguntas para todos los segmentos de un libro (MCQ).
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
      `Libro ${libroId}: generando banco MCQ para ${segmentos.length} segmentos (paralelo x${CONCURRENCIA_SEGMENTOS})...`,
    );

    await runWithLimit(segmentos, CONCURRENCIA_SEGMENTOS, async (seg, i) => {
      if (i > 0) await sleep(DELAY_ENTRE_LOTES_MS);
      this.logger.log(`Libro ${libroId}: segmento ${i + 1}/${segmentos.length} (id=${seg.id})`);
      try {
        await this.generarYGuardarBancoParaSegmento(seg.id, BigInt(libroId));
      } catch (err) {
        this.logger.error(`Error generando banco para segmento ${seg.id}: ${String(err)}`);
      }
    });

    this.logger.log(`Libro ${libroId}: banco MCQ generado para todos los segmentos.`);
  }

  /**
   * @deprecated Legacy method
   */
  async generarYGuardarPreguntasParaSegmento(
    segmentoId: number,
  ): Promise<{ guardadas: number; errores: number }> {
    const segmento = await this.prisma.segmento.findUnique({
      where: { id: BigInt(segmentoId) },
      select: { libroId: true },
    });
    if (!segmento) return { guardadas: 0, errores: 1 };
    try {
      const preguntas = await this.generarYGuardarBancoParaSegmento(
        BigInt(segmentoId),
        segmento.libroId,
      );
      return { guardadas: preguntas.length, errores: 0 };
    } catch {
      return { guardadas: 0, errores: 1 };
    }
  }

  /**
   * @deprecated Legacy method
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

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private describirNivelEscolar(grado: number): string {
    if (grado <= 6) return 'primaria';
    if (grado <= 9) return 'secundaria';
    return 'preparatoria';
  }

  private parsearBancoGroq(raw: string): GroqBancoResponse | null {
    try {
      let jsonStr = raw;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) jsonStr = raw.slice(start, end);
      const obj = JSON.parse(jsonStr) as Partial<GroqBancoResponse>;
      if (!Array.isArray(obj.preguntas) || obj.preguntas.length === 0) return null;
      return {
        preguntas: obj.preguntas.filter(
          (p) =>
            p.texto &&
            p.opcion_a &&
            p.opcion_b &&
            p.opcion_c &&
            p.opcion_d &&
            p.respuesta_correcta &&
            p.nivel &&
            p.tipo,
        ),
        pista_contextual: obj.pista_contextual ?? '',
        resumen: obj.resumen ?? '',
      };
    } catch {
      return null;
    }
  }
}
