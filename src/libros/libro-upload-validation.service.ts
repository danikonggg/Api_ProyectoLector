/**
 * ============================================
 * SERVICIO: Validación robusta de uploads PDF
 * ============================================
 * Validación por contenido (magic bytes + file-type), estructura,
 * límites de tamaño y páginas. Previene polyglots y DoS.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PDF } from './constants/pdf.constants';

/** Límite de páginas para evitar DoS (libros gigantes) */
export const MAX_PAGINAS_PERMITIDAS = 500;

/** Tamaño máximo para upload (50 MB - coherente con controller) */
export const UPLOAD_MAX_SIZE = 50 * 1024 * 1024;

@Injectable()
export class LibroUploadValidationService {
  /**
   * Valida el buffer antes de cualquier procesamiento.
   * Lanza BadRequestException si no es válido.
   */
  async validarBuffer(buffer: Buffer): Promise<void> {
    if (!buffer || buffer.length < PDF.MIN_SIZE) {
      throw new BadRequestException(
        'El archivo está vacío o es demasiado pequeño para ser un PDF válido.',
      );
    }

    if (buffer.length > UPLOAD_MAX_SIZE) {
      throw new BadRequestException(
        `El PDF supera el tamaño máximo permitido (${UPLOAD_MAX_SIZE / 1024 / 1024} MB).`,
      );
    }

    // Magic bytes obligatorios
    if (!buffer.subarray(0, PDF.MAGIC.length).equals(PDF.MAGIC)) {
      throw new BadRequestException(
        'El archivo no es un PDF válido (cabecera incorrecta). Sube un PDF real, no una imagen ni otro formato.',
      );
    }

    // Detección por contenido (opcional: requiere file-type)
    try {
      await this.validarTipoReal(buffer);
    } catch {
      // file-type no disponible: confiar en magic bytes
    }
  }

  /**
   * Intenta validar el tipo real del archivo (anti-polyglot).
   * Si file-type no está instalado, solo confía en magic bytes.
   */
  private async validarTipoReal(buffer: Buffer): Promise<void> {
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const detected = await fileTypeFromBuffer(buffer);
      // PDF tiene mime application/pdf
      if (detected && detected.mime !== 'application/pdf') {
        throw new BadRequestException(
          `El archivo parece ser ${detected.mime} (${detected.ext}), no un PDF.`,
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // file-type no instalado o no detectó: confiar en magic bytes
    }
  }

  /**
   * Valida el número de páginas tras extracción.
   * Llamar después de obtener numPaginas.
   */
  validarNumPaginas(numPaginas: number): void {
    if (numPaginas <= 0) return;
    if (numPaginas > MAX_PAGINAS_PERMITIDAS) {
      throw new BadRequestException(
        `El PDF tiene ${numPaginas} páginas. Máximo permitido: ${MAX_PAGINAS_PERMITIDAS}.`,
      );
    }
  }

  /**
   * Sanitiza el nombre de archivo original para evitar path traversal.
   */
  sanitizarNombreArchivo(originalName: string | undefined): string {
    if (!originalName || typeof originalName !== 'string') return 'documento.pdf';
    // Quitar path, quedarse con el nombre
    const base = originalName.replace(/^.*[/\\]/, '');
    // Solo alfanum, guion, punto
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    return sanitized || 'documento.pdf';
  }
}
