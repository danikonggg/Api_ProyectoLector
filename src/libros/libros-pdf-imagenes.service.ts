/**
 * ============================================
 * SERVICIO: Extracción PDF → imágenes (PRUEBA)
 * ============================================
 * Convierte cada página del PDF a imagen PNG.
 * Flujo separado del cargar normal - solo para probar.
 * Usa pdf-to-img (pdfjs-dist sin dependencias nativas).
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const PDFS_DIR = 'pdfs';
const PRUEBA_DIR = 'prueba';
const IMAGENES_LIBROS_DIR = 'imagenes';

@Injectable()
export class LibrosPdfImagenesService {
  private readonly logger = new Logger(LibrosPdfImagenesService.name);

  /**
   * Extrae cada página del PDF como imagen PNG.
   * Guarda en pdfs/prueba/{sessionId}/1.png, 2.png, ...
   * @returns sessionId y array de números de página para que el front pida imagen por imagen
   */
  async extraerPaginasComoImagenes(buffer: Buffer): Promise<{
    sessionId: string;
    numPaginas: number;
    urls: Array<{ numero: number; url: string }>;
  }> {
    if (!buffer || buffer.length < 100) {
      throw new BadRequestException('El archivo PDF está vacío o es inválido.');
    }

    const sessionId = uuidv4().slice(0, 8);
    const baseDir = path.join(process.cwd(), PDFS_DIR, PRUEBA_DIR, sessionId);
    await fs.mkdir(baseDir, { recursive: true });

    const tempPdfPath = path.join(baseDir, 'temp.pdf');
    await fs.writeFile(tempPdfPath, buffer);

    try {
      const { pdf } = await import('pdf-to-img');
      const document = await pdf(tempPdfPath, { scale: 2 });

      const urls: Array<{ numero: number; url: string }> = [];
      let numero = 1;

      for await (const image of document) {
        const fileName = `${numero}.png`;
        const filePath = path.join(baseDir, fileName);
        await fs.writeFile(filePath, image);
        urls.push({
          numero,
          url: `/libros/probar-paginas-imagen/${sessionId}/${numero}`,
        });
        numero++;
      }

      await fs.unlink(tempPdfPath).catch(() => {});
      this.logger.log(`Prueba ${sessionId}: ${numero - 1} páginas convertidas a imagen.`);

      return {
        sessionId,
        numPaginas: numero - 1,
        urls,
      };
    } catch (e) {
      await fs.unlink(tempPdfPath).catch(() => {});
      await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
      const msg = (e as Error)?.message ?? String(e);
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
        throw new BadRequestException('El PDF está protegido con contraseña.');
      }
      throw new BadRequestException(`No se pudo extraer imágenes del PDF: ${msg.slice(0, 150)}`);
    }
  }

  /**
   * Guarda cada página del PDF como imagen PNG, vinculada al libro.
   * Ruta: pdfs/imagenes/{codigo}_{libroId}/1.png, 2.png, ...
   * No rompe el flujo si falla; devuelve numPaginas guardadas o 0.
   */
  async guardarPaginasParaLibro(
    buffer: Buffer,
    libroId: number,
    codigo: string,
  ): Promise<number> {
    if (!buffer || buffer.length < 100) return 0;

    const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'libro';
    const dirName = `${slug}_${libroId}`;
    const baseDir = path.join(process.cwd(), PDFS_DIR, IMAGENES_LIBROS_DIR, dirName);
    await fs.mkdir(baseDir, { recursive: true });

    const tempPdfPath = path.join(baseDir, '_temp.pdf');
    await fs.writeFile(tempPdfPath, buffer);

    try {
      const { pdf } = await import('pdf-to-img');
      const document = await pdf(tempPdfPath, { scale: 2 });

      let numero = 1;
      for await (const image of document) {
        const filePath = path.join(baseDir, `${numero}.png`);
        await fs.writeFile(filePath, image);
        numero++;
      }

      await fs.unlink(tempPdfPath).catch(() => {});
      this.logger.log(`Libro ${libroId}: ${numero - 1} páginas guardadas como imágenes.`);
      return numero - 1;
    } catch (e) {
      await fs.unlink(tempPdfPath).catch(() => {});
      await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
      this.logger.warn(`No se pudieron generar imágenes para libro ${libroId}: ${(e as Error)?.message ?? e}`);
      return 0;
    }
  }

  /**
   * Elimina la carpeta de imágenes de un libro (al eliminar el libro).
   */
  async eliminarImagenesLibro(libroId: number, codigo: string): Promise<void> {
    const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'libro';
    const dirPath = path.join(process.cwd(), PDFS_DIR, IMAGENES_LIBROS_DIR, `${slug}_${libroId}`);
    await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
  }

  /**
   * Devuelve la ruta absoluta de la imagen de una página de un libro.
   * Para servir en GET /libros/:id/paginas/:numero/imagen
   */
  async rutaImagenPaginaLibro(
    libroId: number,
    codigo: string,
    numeroPagina: number,
  ): Promise<string | null> {
    const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'libro';
    const relPath = path.join(PDFS_DIR, IMAGENES_LIBROS_DIR, `${slug}_${libroId}`, `${numeroPagina}.png`);
    const absPath = path.join(process.cwd(), relPath);
    try {
      await fs.access(absPath, fs.constants.R_OK);
      return absPath;
    } catch {
      return null;
    }
  }

  /**
   * Devuelve la ruta absoluta de una imagen de página generada en prueba.
   */
  async rutaImagenPrueba(sessionId: string, numeroPagina: number): Promise<string | null> {
    const relPath = path.join(PDFS_DIR, PRUEBA_DIR, sessionId, `${numeroPagina}.png`);
    const absPath = path.join(process.cwd(), relPath);
    try {
      await fs.access(absPath, fs.constants.R_OK);
      return absPath;
    } catch {
      return null;
    }
  }
}
