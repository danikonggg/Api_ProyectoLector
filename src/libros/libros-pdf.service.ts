/**
 * ============================================
 * SERVICIO: Procesamiento de PDF
 * ============================================
 * Extrae texto, limpia, divide en segmentos (~100–200 palabras).
 * Sin IA: solo extracción y segmentación.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

const MIN_WORDS_PER_SEGMENT = 80;
const MAX_WORDS_PER_SEGMENT = 200;
const TARGET_WORDS_PER_SEGMENT = 150;

export interface TextoExtraido {
  texto: string;
  numPaginas: number;
}

export interface SegmentoDto {
  contenido: string;
  orden: number;
  numeroPagina: number | null;
  idExterno: string;
}

@Injectable()
export class LibrosPdfService {
  /**
   * Extrae texto del PDF (buffer).
   */
  async extraerTexto(buffer: Buffer): Promise<TextoExtraido> {
    let pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      pdfParse = require('pdf-parse');
    } catch {
      throw new BadRequestException(
        'No se pudo cargar el módulo pdf-parse. Ejecuta: npm install pdf-parse',
      );
    }

    const data = await pdfParse(buffer);
    const texto = (data?.text || '').trim();
    const numPaginas = data?.numpages ?? 0;

    if (!texto || texto.length < 50) {
      throw new BadRequestException(
        'El PDF no contiene texto extraíble o el archivo no es válido.',
      );
    }

    return { texto, numPaginas };
  }

  /**
   * Normaliza texto: saltos de línea, guiones partidos, espacios.
   */
  limpiarTexto(texto: string): string {
    let t = texto
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\u00a0/g, ' ');

    // Unir palabras partidas por guión al final de línea (ej. "ejem-\nplo" -> "ejemplo")
    t = t.replace(/([a-zA-Záéíóúñ])-\s*\n\s*([a-zA-Záéíóúñ])/g, '$1$2');

    // Colapsar múltiples espacios y saltos
    t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    return t;
  }

  /**
   * Divide en segmentos de ~100–200 palabras (1 idea por segmento).
   * Estrategia: cortar por párrafos cuando sea posible; si no, por frases.
   */
  dividirEnSegmentos(texto: string, numPaginas: number): SegmentoDto[] {
    const segmentos: SegmentoDto[] = [];
    const parrafos = texto.split(/\n\n+/).filter((p) => p.trim().length > 0);

    let acu = '';
    let orden = 0;
    const palabrasPorPagina =
      numPaginas > 0
        ? Math.max(1, Math.ceil(this.contarPalabras(texto) / numPaginas))
        : 0;
    let palabrasEnPagina = 0;
    let paginaActual = 1;

    const flush = (contenido: string, pag?: number) => {
      const c = contenido.trim();
      if (!c) return;
      orden += 1;
      segmentos.push({
        contenido: c,
        orden,
        numeroPagina: pag ?? null,
        idExterno: uuidv4(),
      });
    };

    for (const p of parrafos) {
      const palabras = this.contarPalabras(p);

      if (acu) {
        const total = this.contarPalabras(acu) + palabras;

        if (total >= MIN_WORDS_PER_SEGMENT && total <= MAX_WORDS_PER_SEGMENT) {
          acu += '\n\n' + p;
          flush(acu, paginaActual);
          acu = '';
          palabrasEnPagina = 0;
          continue;
        }

        if (total > MAX_WORDS_PER_SEGMENT) {
          if (this.contarPalabras(acu) >= MIN_WORDS_PER_SEGMENT) {
            flush(acu, paginaActual);
            acu = '';
            palabrasEnPagina = 0;
          }
        }
      }

      if (this.contarPalabras(p) >= MIN_WORDS_PER_SEGMENT) {
        if (acu) {
          flush(acu, paginaActual);
          acu = '';
        }
        if (palabras <= MAX_WORDS_PER_SEGMENT) {
          flush(p, paginaActual);
          palabrasEnPagina = 0;
        } else {
          const chunks = this.cortarPorPalabras(p, TARGET_WORDS_PER_SEGMENT);
          chunks.forEach((chunk) => flush(chunk, paginaActual));
          palabrasEnPagina = 0;
        }
        continue;
      }

      acu = acu ? acu + '\n\n' + p : p;
      palabrasEnPagina += palabras;

      if (palabrasPorPagina > 0 && palabrasEnPagina >= palabrasPorPagina) {
        paginaActual += 1;
        palabrasEnPagina = 0;
      }

      if (this.contarPalabras(acu) >= TARGET_WORDS_PER_SEGMENT) {
        flush(acu, paginaActual);
        acu = '';
        palabrasEnPagina = 0;
      }
    }

    if (acu.trim()) flush(acu, paginaActual);

    return segmentos;
  }

  private contarPalabras(s: string): number {
    return s
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  private cortarPorPalabras(
    texto: string,
    tamano: number,
  ): string[] {
    const partes: string[] = [];
    const palabras = texto.trim().split(/\s+/);

    for (let i = 0; i < palabras.length; i += tamano) {
      const trozo = palabras.slice(i, i + tamano).join(' ');
      if (trozo) partes.push(trozo);
    }

    return partes;
  }

  /**
   * Pipeline completo: extraer → limpiar → segmentar.
   */
  async procesarPdf(buffer: Buffer): Promise<{
    texto: string;
    numPaginas: number;
    segmentos: SegmentoDto[];
  }> {
    const { texto: raw, numPaginas } = await this.extraerTexto(buffer);
    const limpio = this.limpiarTexto(raw);
    const segmentos = this.dividirEnSegmentos(limpio, numPaginas);

    return {
      texto: limpio,
      numPaginas,
      segmentos,
    };
  }
}
