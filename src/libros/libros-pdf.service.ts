/**
 * ============================================
 * SERVICIO: Procesamiento de PDF
 * ============================================
 * Usa pdfjs-dist (Mozilla PDF.js) para extracción de alta calidad.
 * Validación robusta, limpieza exhaustiva y segmentación que no pierde contenido.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PDF, SEGMENTOS, ORACION_REGEX } from './constants/pdf.constants';
import { limpiarTextoPdf } from './pdf-text-cleaner';

export interface TextoExtraido {
  texto: string;
  numPaginas: number;
  textoPorPagina?: string[];
}

export interface SegmentoDto {
  contenido: string;
  orden: number;
  numeroPagina: number | null;
  idExterno: string;
}

@Injectable()
export class LibrosPdfService {
  private workerSrcInitialized = false;

  /**
   * Configura el worker de pdfjs-dist para Node.js (solo una vez).
   */
  private async initPdfJsWorker(): Promise<void> {
    if (this.workerSrcInitialized) return;
    try {
      const pdfjs = await import('pdfjs-dist');
      const pdfjsMain = require.resolve('pdfjs-dist');
      const workerPath = path.join(
        path.dirname(pdfjsMain),
        'pdf.worker.mjs',
      );
      pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
      this.workerSrcInitialized = true;
    } catch {
      // Fallback: intentar sin worker (modo legacy, más lento)
      this.workerSrcInitialized = true;
    }
  }

  /**
   * Valida que el buffer sea un PDF válido: magic bytes, tamaño min/max.
   */
  validarPdf(buffer: Buffer): void {
    if (!buffer || buffer.length < PDF.MIN_SIZE) {
      throw new BadRequestException(
        'El archivo está vacío o es demasiado pequeño para ser un PDF válido.',
      );
    }
    if (buffer.length > PDF.MAX_SIZE) {
      throw new BadRequestException(
        `El PDF supera el tamaño máximo permitido (${PDF.MAX_SIZE / 1024 / 1024} MB).`,
      );
    }
    if (!buffer.subarray(0, PDF.MAGIC.length).equals(PDF.MAGIC)) {
      throw new BadRequestException(
        'El archivo no es un PDF válido (cabecera incorrecta). Asegúrate de subir un PDF, no una imagen ni otro formato.',
      );
    }
  }

  /**
   * Extrae texto del PDF. Intenta pdfjs-dist primero; si falla, usa pdf-parse como fallback.
   */
  async extraerTexto(buffer: Buffer): Promise<TextoExtraido> {
    this.validarPdf(buffer);

    const resultado = await this.extraerConPdfJs(buffer);
    if (resultado) return resultado;

    return this.extraerConPdfParse(buffer);
  }

  /**
   * Intenta extraer con pdfjs-dist (Mozilla PDF.js) - mejor calidad.
   * Si falla la carga del módulo, retorna null para usar pdf-parse como fallback.
   */
  private async extraerConPdfJs(buffer: Buffer): Promise<TextoExtraido | null> {
    let pdfjs: { getDocument?: unknown; default?: { getDocument?: unknown } };
    try {
      await this.initPdfJsWorker();
      pdfjs = await import('pdfjs-dist');
    } catch {
      return null;
    }

    const getDocument = (pdfjs.default?.getDocument ?? pdfjs.getDocument) as (
      src: unknown,
    ) => { promise: Promise<unknown> };

    const uint8 = new Uint8Array(buffer);

    let pdfDoc: {
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string; hasEOL?: boolean }>;
        }>;
      }>;
    };

    try {
      const loadingTask = getDocument({ data: uint8 });
      pdfDoc = (await loadingTask.promise) as typeof pdfDoc;
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e);
      const lower = msg.toLowerCase();

      if (
        lower.includes('password') ||
        lower.includes('contraseña') ||
        lower.includes('encrypt')
      ) {
        throw new BadRequestException(
          'El PDF está protegido con contraseña. Sube una versión sin protección.',
        );
      }
      if (
        lower.includes('invalid') ||
        lower.includes('corrupt') ||
        lower.includes('corrupted') ||
        lower.includes('malformed') ||
        lower.includes('unexpected')
      ) {
        throw new BadRequestException(
          'El PDF parece estar dañado o tener un formato no soportado. Prueba con otro archivo.',
        );
      }
      throw new BadRequestException(
        `No se pudo leer el PDF: ${msg.slice(0, 120)}`,
      );
    }

    const numPaginas = pdfDoc.numPages;
    const textoPorPagina: string[] = [];

    for (let i = 1; i <= numPaginas; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items;

      const lineParts: string[] = [];
      let currentLine = '';

      for (const item of items) {
        if ('str' in item && typeof item.str === 'string') {
          currentLine += item.str;
          if ((item as { hasEOL?: boolean }).hasEOL) {
            lineParts.push(currentLine.trim());
            currentLine = '';
          }
        }
      }
      if (currentLine.trim()) {
        lineParts.push(currentLine.trim());
      }

      const pageText = lineParts.join('\n').trim();
      textoPorPagina.push(pageText);
    }

    const texto = textoPorPagina.join('\n\n').trim();

    if (!texto || texto.length < PDF.MIN_TEXT_LENGTH) {
      if (texto.length > 0 && texto.length < PDF.MIN_TEXT_LENGTH_ESCANEADO) {
        throw new BadRequestException(
          'El PDF parece ser un escaneo (solo imágenes). Solo se puede extraer texto de PDFs con texto seleccionable. Prueba con un PDF digital o OCR.',
        );
      }
      throw new BadRequestException(
        'El PDF no contiene texto extraíble o el archivo no es válido. Verifica que sea un PDF con texto (no solo imágenes).',
      );
    }

    return { texto, numPaginas, textoPorPagina };
  }

  /**
   * Fallback: extrae con pdf-parse cuando pdfjs-dist no está disponible.
   * pdf-parse v2 usa PDFParse con getText().
   */
  private async extraerConPdfParse(buffer: Buffer): Promise<TextoExtraido> {
    let PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
      getText: () => Promise<{ text: string; total: number }>;
    };
    try {
      const mod = require('pdf-parse');
      PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod;
      if (typeof PDFParse !== 'function') {
        throw new Error('PDFParse no encontrado');
      }
    } catch {
      throw new BadRequestException(
        'No se pudo cargar ninguna librería de PDF. Ejecuta: npm install pdfjs-dist pdf-parse',
      );
    }

    let result: { text: string; total: number };
    try {
      const parser = new PDFParse({ data: buffer });
      result = await parser.getText();
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e);
      const lower = msg.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('contraseña') ||
        lower.includes('encrypt')
      ) {
        throw new BadRequestException(
          'El PDF está protegido con contraseña. Sube una versión sin protección.',
        );
      }
      if (
        lower.includes('invalid') ||
        lower.includes('corrupt') ||
        lower.includes('corrupted') ||
        lower.includes('malformed')
      ) {
        throw new BadRequestException(
          'El PDF parece estar dañado. Prueba con otro archivo.',
        );
      }
      throw new BadRequestException(
        `No se pudo leer el PDF: ${msg.slice(0, 120)}`,
      );
    }

    const texto = (result?.text ?? '').trim();
    const numPaginas = result?.total ?? 0;

    if (!texto || texto.length < PDF.MIN_TEXT_LENGTH) {
      if (texto.length > 0 && texto.length < PDF.MIN_TEXT_LENGTH_ESCANEADO) {
        throw new BadRequestException(
          'El PDF parece ser un escaneo (solo imágenes). Solo se admite texto seleccionable.',
        );
      }
      throw new BadRequestException(
        'El PDF no contiene texto extraíble. Verifica que sea un PDF con texto.',
      );
    }

    return { texto, numPaginas };
  }

  /**
   * Limpieza exhaustiva delegada a pdf-text-cleaner.
   */
  limpiarTexto(texto: string): string {
    return limpiarTextoPdf(texto);
  }

  /**
   * Cuenta palabras (espacios). No pierde contenido por guiones ni símbolos.
   */
  private contarPalabras(s: string): number {
    return s
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  /**
   * Emite un segmento si el contenido supera el mínimo (o allowSmall para resto final).
   */
  private flush(
    segmentos: SegmentoDto[],
    ordenRef: { n: number },
    contenido: string,
    paginaActual: number,
    allowSmall = false,
  ): void {
    const c = contenido.trim();
    if (!c) return;
    const palabras = this.contarPalabras(c);
    const min = allowSmall
      ? SEGMENTOS.MIN_WORDS_FLUSH_REST
      : SEGMENTOS.MIN_WORDS_SEGMENT;
    if (palabras < min) return;
    ordenRef.n += 1;
    segmentos.push({
      contenido: c,
      orden: ordenRef.n,
      numeroPagina: null,
      idExterno: uuidv4(),
    });
  }

  /**
   * Obtiene párrafos (doble salto) y, si no hay ninguno útil, un único bloque (texto sin \n\n).
   */
  private obtenerParrafos(texto: string): string[] {
    const porParrafo = texto.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const filtrados = porParrafo.filter((p) => {
      return (
        p.length > SEGMENTOS.MIN_LEN_PARRAFO &&
        this.contarPalabras(p) > SEGMENTOS.MIN_WORDS_PARRAFO
      );
    });
    if (filtrados.length > 0) return filtrados;
    const total = this.contarPalabras(texto);
    if (
      total >= SEGMENTOS.MIN_WORDS_PARRAFO &&
      texto.trim().length > SEGMENTOS.MIN_LEN_PARRAFO
    ) {
      return [texto.trim()];
    }
    return [];
  }

  /**
   * Divide un bloque grande por oraciones (. ! ? … ¿ ¡ y dobles saltos) y luego en chunks de ~target palabras.
   */
  private dividirPorOracionesYPalabras(
    texto: string,
    targetPalabras: number,
  ): string[] {
    const partes: string[] = [];
    const raw = texto.trim();
    if (!raw) return partes;

    const fragmentos = raw
      .split(new RegExp(`(${ORACION_REGEX.source})`, 'g'))
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    let acu = '';
    let palabrasAcu = 0;

    for (const f of fragmentos) {
      const p = this.contarPalabras(f);
      const esDelimitador = /^[.!?…¿¡\s\n]+$/.test(f) || f === '';

      if (esDelimitador) {
        if (acu) acu += f;
        continue;
      }

      const siguiente = acu ? acu + ' ' + f : f;
      const palabrasSiguiente = this.contarPalabras(siguiente);

      if (palabrasSiguiente <= targetPalabras * 1.3) {
        acu = siguiente;
        palabrasAcu = palabrasSiguiente;
      } else {
        if (acu && palabrasAcu >= targetPalabras * 0.5) {
          partes.push(acu.trim());
          acu = f;
          palabrasAcu = p;
        } else {
          if (acu) {
            partes.push(acu.trim());
            acu = '';
            palabrasAcu = 0;
          }
          const chunks = this.cortarPorPalabras(f, targetPalabras);
          partes.push(...chunks);
        }
      }
    }

    if (
      acu.trim() &&
      this.contarPalabras(acu) >= SEGMENTOS.MIN_WORDS_FLUSH_REST
    ) {
      partes.push(acu.trim());
    }

    const out = partes.filter((p) => p.trim().length > 0);
    if (out.length === 0 && raw.length > 0) {
      return this.cortarPorPalabras(raw, targetPalabras);
    }
    return out;
  }

  private cortarPorPalabras(texto: string, tamano: number): string[] {
    const partes: string[] = [];
    const palabras = texto
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    for (let i = 0; i < palabras.length; i += tamano) {
      const trozo = palabras.slice(i, i + tamano).join(' ');
      if (trozo.trim()) partes.push(trozo.trim());
    }
    return partes;
  }

  /**
   * Divide en segmentos (~200–500 palabras), respetando párrafos y oraciones. No pierde contenido.
   */
  dividirEnSegmentos(texto: string, numPaginas: number): SegmentoDto[] {
    const parrafos = this.obtenerParrafos(texto);
    const segmentos: SegmentoDto[] = [];
    const ordenRef = { n: 0 };

    const palabrasTotal = this.contarPalabras(texto);
    const palabrasPorPagina =
      numPaginas > 0
        ? Math.max(1, Math.ceil(palabrasTotal / numPaginas))
        : 0;
    let palabrasEnPagina = 0;
    let paginaActual = 1;

    const flush = (c: string, pag: number, allowSmall = false) => {
      this.flush(segmentos, ordenRef, c, pag, allowSmall);
    };

    let acu = '';

    for (const p of parrafos) {
      const palabras = this.contarPalabras(p);

      if (acu) {
        const total = this.contarPalabras(acu) + palabras;

        if (total >= SEGMENTOS.MIN_WORDS && total <= SEGMENTOS.MAX_WORDS) {
          acu += '\n\n' + p;
          flush(acu, paginaActual);
          acu = '';
          palabrasEnPagina += palabras;
          if (palabrasPorPagina > 0 && palabrasEnPagina >= palabrasPorPagina) {
            paginaActual += 1;
            palabrasEnPagina = 0;
          }
          continue;
        }

        if (total > SEGMENTOS.MAX_WORDS) {
          if (this.contarPalabras(acu) >= SEGMENTOS.MIN_WORDS) {
            flush(acu, paginaActual);
            acu = '';
            palabrasEnPagina = 0;
          } else {
            const partes = this.dividirPorOracionesYPalabras(
              p,
              SEGMENTOS.TARGET_WORDS,
            );
            const acuMasPrimera = acu + '\n\n' + (partes[0] ?? '');
            const palAcuPrimera = this.contarPalabras(acuMasPrimera);

            if (partes.length > 0 && palAcuPrimera <= SEGMENTOS.MAX_WORDS) {
              acu = acuMasPrimera;
              flush(acu, paginaActual);
              acu = '';
              palabrasEnPagina = 0;
              for (let i = 1; i < partes.length; i++) {
                const r = partes[i]!;
                this.procesarResto(
                  r,
                  flush,
                  () => paginaActual,
                  (x) => (paginaActual = x),
                  palabrasPorPagina,
                  () => palabrasEnPagina,
                  (x) => (palabrasEnPagina = x),
                );
              }
            } else {
              flush(acu, paginaActual);
              acu = partes[0] ?? '';
              palabrasEnPagina = this.contarPalabras(acu);
              for (let i = 1; i < partes.length; i++) {
                const r = partes[i]!;
                this.procesarResto(
                  r,
                  flush,
                  () => paginaActual,
                  (x) => (paginaActual = x),
                  palabrasPorPagina,
                  () => palabrasEnPagina,
                  (x) => (palabrasEnPagina = x),
                );
              }
            }
            continue;
          }
        }
      }

      if (palabras >= SEGMENTOS.MIN_WORDS) {
        if (acu) {
          flush(acu, paginaActual);
          acu = '';
        }
        if (palabras <= SEGMENTOS.MAX_WORDS) {
          flush(p, paginaActual);
          palabrasEnPagina += palabras;
        } else {
          const chunks = this.dividirPorOracionesYPalabras(
            p,
            SEGMENTOS.TARGET_WORDS,
          );
          for (const c of chunks) {
            flush(c, paginaActual);
            palabrasEnPagina += this.contarPalabras(c);
          }
        }
        if (palabrasPorPagina > 0 && palabrasEnPagina >= palabrasPorPagina) {
          paginaActual += 1;
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
      if (this.contarPalabras(acu) >= SEGMENTOS.TARGET_WORDS) {
        flush(acu, paginaActual);
        acu = '';
        palabrasEnPagina = 0;
      }
    }

    const restPalabras = this.contarPalabras(acu);
    if (acu.trim()) {
      if (restPalabras >= SEGMENTOS.MIN_WORDS_REST) {
        flush(acu, paginaActual);
      } else if (restPalabras >= SEGMENTOS.MIN_WORDS_FLUSH_REST) {
        flush(acu, paginaActual, true);
      }
    }

    return segmentos;
  }

  private procesarResto(
    r: string,
    flush: (c: string, pag: number, allowSmall?: boolean) => void,
    getPag: () => number,
    setPag: (n: number) => void,
    palabrasPorPagina: number,
    getPalEnPag: () => number,
    setPalEnPag: (n: number) => void,
  ): void {
    const pr = this.contarPalabras(r);
    const pag = getPag();
    let enPag = getPalEnPag();

    if (pr >= SEGMENTOS.MIN_WORDS && pr <= SEGMENTOS.MAX_WORDS) {
      flush(r, pag);
      enPag += pr;
    } else if (pr > SEGMENTOS.MAX_WORDS) {
      const ch = this.dividirPorOracionesYPalabras(r, SEGMENTOS.TARGET_WORDS);
      ch.forEach((c) => {
        flush(c, pag);
        enPag += this.contarPalabras(c);
      });
    } else {
      flush(r, pag, true);
      enPag += pr;
    }
    if (palabrasPorPagina > 0 && enPag >= palabrasPorPagina) {
      setPag(pag + 1);
      enPag = 0;
    }
    setPalEnPag(enPag);
  }

  /**
   * Pipeline completo: validar → extraer → limpiar → segmentar.
   */
  async procesarPdf(buffer: Buffer): Promise<{
    texto: string;
    numPaginas: number;
    segmentos: SegmentoDto[];
  }> {
    const { texto: raw, numPaginas } = await this.extraerTexto(buffer);
    const limpio = this.limpiarTexto(raw);
    const segmentos = this.dividirEnSegmentos(limpio, numPaginas);
    return { texto: limpio, numPaginas, segmentos };
  }
}
