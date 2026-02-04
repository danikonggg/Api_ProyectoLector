/**
 * ============================================
 * SERVICIO: Almacenamiento de PDFs en disco
 * ============================================
 * Guarda los PDFs procesados en la carpeta pdfs/ del backend.
 * Retorna la ruta relativa (ej. pdfs/LIB-xxx_1.pdf) para persistir en Libro.
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export const PDFS_DIR = 'pdfs';
const PDF_EXT = '.pdf';

@Injectable()
export class PdfStorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), PDFS_DIR);
  }

  /**
   * Asegura que exista la carpeta pdfs/ en el proyecto.
   */
  async ensurePdfsDir(): Promise<string> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      return this.baseDir;
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo crear la carpeta ${PDFS_DIR}. ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Guarda el buffer del PDF en pdfs/{codigo}_{libroId}.pdf.
   * Código se sanitiza (solo alfanum y guiones).
   * Retorna ruta relativa: pdfs/COD_1.pdf
   */
  async guardar(
    buffer: Buffer,
    libroId: number,
    codigo: string,
  ): Promise<string> {
    await this.ensurePdfsDir();
    const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'libro';
    const fileName = `${slug}_${libroId}${PDF_EXT}`;
    const filePath = path.join(this.baseDir, fileName);
    const relPath = `${PDFS_DIR}/${fileName}`;

    try {
      await fs.writeFile(filePath, buffer, { flag: 'w' });
      return relPath;
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo guardar el PDF en ${relPath}. ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Elimina el archivo PDF del disco por ruta relativa.
   */
  async eliminarArchivo(rutaRelativa: string): Promise<boolean> {
    if (!rutaRelativa?.startsWith(PDFS_DIR + '/')) return false;
    const abs = path.join(process.cwd(), rutaRelativa);
    try {
      await fs.unlink(abs);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Devuelve la ruta absoluta del PDF si existe; null si no.
   */
  async rutaAbsoluta(rutaRelativa: string): Promise<string | null> {
    if (!rutaRelativa?.startsWith(PDFS_DIR + '/')) return null;
    const abs = path.join(process.cwd(), rutaRelativa);
    try {
      await fs.access(abs, fs.constants.R_OK);
      return abs;
    } catch {
      return null;
    }
  }
}
