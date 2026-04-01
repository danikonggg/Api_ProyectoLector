/**
 * ============================================
 * SERVICIO: Almacenamiento temporal de PDFs
 * ============================================
 * Guarda el buffer del PDF en disco temporal antes de procesar (flujo async).
 * El worker lee desde aquí. Se limpia tras procesamiento exitoso.
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const TEMP_DIR = 'pdfs_temp';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

@Injectable()
export class LibroStorageTempService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), TEMP_DIR);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Guarda el buffer temporalmente. Retorna la clave para recuperarlo.
   */
  async guardarTemporal(buffer: Buffer, prefijo: string): Promise<string> {
    await this.ensureDir();
    const clave = `${prefijo}_${uuidv4().slice(0, 8)}.pdf`;
    const filePath = path.join(this.baseDir, clave);
    try {
      await fs.writeFile(filePath, buffer, { flag: 'w' });
      return clave;
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo guardar el PDF temporal: ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Lee el buffer desde almacenamiento temporal.
   */
  async leerTemporal(clave: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, clave);
    try {
      return await fs.readFile(filePath);
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo leer el PDF temporal (clave=${clave}): ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Elimina el archivo temporal tras procesamiento exitoso.
   */
  async eliminarTemporal(clave: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, clave);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ruta absoluta (para workers que leen directamente).
   */
  rutaAbsoluta(clave: string): string {
    return path.join(this.baseDir, clave);
  }
}
