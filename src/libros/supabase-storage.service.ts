/**
 * ============================================
 * SERVICIO: Almacenamiento de PDFs en Supabase
 * ============================================
 * Sube los PDFs a Supabase Storage en lugar del disco local.
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PDF_EXT = '.pdf';

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;
  private readonly signedUrlExpiresInSec: number;
  private readonly logger = new Logger(SupabaseStorageService.name);

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET', 'api-lector-pdfs');
    const signedUrlTtlRaw = Number(
      this.configService.get<string>('SUPABASE_SIGNED_URL_TTL_SECONDS', '300'),
    );
    this.signedUrlExpiresInSec =
      Number.isFinite(signedUrlTtlRaw) && signedUrlTtlRaw > 0 ? Math.floor(signedUrlTtlRaw) : 300;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno. Las subidas a Supabase fallarán si no se configuran.',
      );
      // Crear cliente dummy o dejar que falle al inicializar
      this.supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'dummy');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Asegura que exista el bucket (requiere que la service_role key tenga permisos,
   * usualmente esto se hace desde el panel de Supabase).
   */
  async ensureBucket(): Promise<void> {
    try {
      const { error } = await this.supabase.storage.getBucket(this.bucketName);
      if (error && error.message.includes('not found')) {
        this.logger.warn(`Bucket ${this.bucketName} no encontrado. Se asume que no existe.`);
        // Opcional: intentar crearlo, pero requiere permisos de admin (service_role)
      }
    } catch (e) {
      this.logger.error(`Error verificando bucket: ${(e as Error)?.message}`);
    }
  }

  /**
   * Guarda el buffer del PDF en Supabase Storage.
   * Retorna la ruta relativa: {fileName}
   */
  async guardar(buffer: Buffer, libroId: number, codigo: string): Promise<string> {
    const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'libro';
    const fileName = `${slug}_${libroId}${PDF_EXT}`;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(fileName, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Devolvemos el key/path
      return data.path;
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo guardar el PDF en Supabase Storage. ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Elimina el archivo PDF de Supabase.
   */
  async eliminarArchivo(rutaRelativa: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).remove([rutaRelativa]);

      if (error) {
        this.logger.error(`Error eliminando archivo ${rutaRelativa}: ${error.message}`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene una URL firmada temporal del archivo.
   */
  async obtenerUrl(rutaRelativa: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(rutaRelativa, this.signedUrlExpiresInSec);
      if (error) {
        this.logger.error(`No se pudo firmar URL de ${rutaRelativa}: ${error.message}`);
        return null;
      }
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Descarga el archivo PDF desde Supabase Storage y lo retorna como Buffer.
   */
  async descargarArchivo(rutaRelativa: string): Promise<Buffer> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(rutaRelativa);

      if (error || !data) {
        throw error ?? new Error('Respuesta sin datos al descargar archivo.');
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (e) {
      throw new InternalServerErrorException(
        `No se pudo descargar el PDF desde Supabase Storage. ${(e as Error)?.message ?? e}`,
      );
    }
  }
}
