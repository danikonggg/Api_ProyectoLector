/**
 * ============================================
 * SERVICIO: Orquestación del procesamiento de libros
 * ============================================
 * Lógica pura de procesamiento: extracción, segmentación con unidades,
 * guardado. Usa transacciones para atomicidad y bulk inserts para rendimiento.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { LibrosPdfService } from './libros-pdf.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { SupabaseStorageService } from './supabase-storage.service';
import type { UnidadConSegmentosDto, SegmentoDto } from './libros-pdf.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { LIBRO_ESTADO } from './constants/libro-estado.constants';
import { GlosarioSegmentoService } from './glosario-segmento.service';

export interface ProcesarLibroInput {
  buffer: Buffer;
  libroId: number;
  codigo: string;
  usarUnidadesReales?: boolean;
  /** Si el PDF ya está en disco (API + cola), no volver a escribir el archivo */
  rutaPdfPreexistente?: string | null;
}

export interface ProcesarLibroResult {
  numPaginas: number;
  numUnidades: number;
  numSegmentos: number;
  rutaPdf: string;
}

@Injectable()
export class LibroProcesamientoService {
  private readonly logger = new Logger(LibroProcesamientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly librosPdfService: LibrosPdfService,
    private readonly librosPdfImagenesService: LibrosPdfImagenesService,
    private readonly pdfStorageService: SupabaseStorageService,
    private readonly uploadValidation: LibroUploadValidationService,
    private readonly glosarioSegmentoService: GlosarioSegmentoService,
  ) {}

  /**
   * Ejecuta el pipeline completo de procesamiento.
   * 1. Extracción y segmentación en memoria
   * 2. Guarda PDF en disco
   * 3. Transacción: bulk insert unidades + segmentos + actualiza libro
   */
  async procesar(input: ProcesarLibroInput): Promise<ProcesarLibroResult> {
    const { buffer, libroId, codigo, usarUnidadesReales = true, rutaPdfPreexistente } = input;

    await this.actualizarEstado(libroId, LIBRO_ESTADO.EXRAYENDO);
    const resultado = usarUnidadesReales
      ? await this.librosPdfService.procesarPdfConUnidades(buffer)
      : await this.procesarSinUnidades(buffer);

    this.uploadValidation.validarNumPaginas(resultado.numPaginas);

    await this.actualizarEstado(libroId, LIBRO_ESTADO.SEGMENTANDO);

    const unidades: UnidadConSegmentosDto[] =
      'unidades' in resultado
        ? resultado.unidades
        : [{ nombre: 'Unidad 1', orden: 1, segmentos: resultado.segmentos }];

    const numSegmentos = unidades.reduce((acc, u) => acc + (u.segmentos?.length ?? 0), 0);

    await this.actualizarEstado(libroId, LIBRO_ESTADO.GUARDANDO);

    const rutaPdf = rutaPdfPreexistente
      ? rutaPdfPreexistente
      : await this.pdfStorageService.guardar(buffer, libroId, codigo);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.persistirUnidadesYSegmentosEnTx(libroId, unidades, tx);
        await tx.libro.update({
          where: { id: BigInt(libroId) },
          data: {
            estado: LIBRO_ESTADO.LISTO,
            numPaginas: BigInt(resultado.numPaginas),
            rutaPdf,
          },
        });
      });
    } catch (e) {
      if (!rutaPdfPreexistente) {
        await this.pdfStorageService.eliminarArchivo(rutaPdf);
      }
      throw e;
    }

    try {
      await this.librosPdfImagenesService.guardarPaginasParaLibro(buffer, libroId, codigo);
    } catch (err) {
      this.logger.warn(
        `Imágenes del libro ${libroId} no generadas: ${(err as Error)?.message ?? err}`,
      );
    }

    void this.glosarioSegmentoService.precargarGlosarioLibro(libroId).catch((err) => {
      this.logger.warn(
        `Precarga glosario libro ${libroId} falló (no afecta estado del libro): ${(err as Error)?.message ?? err}`,
      );
    });

    this.logger.log(
      `Libro ${libroId} procesado: ${unidades.length} unidades, ${numSegmentos} segmentos, ${resultado.numPaginas} páginas`,
    );

    return {
      numPaginas: resultado.numPaginas,
      numUnidades: unidades.length,
      numSegmentos,
      rutaPdf,
    };
  }

  private async procesarSinUnidades(buffer: Buffer): Promise<{
    numPaginas: number;
    segmentos: SegmentoDto[];
  }> {
    const r = await this.librosPdfService.procesarPdf(buffer);
    return { numPaginas: r.numPaginas, segmentos: r.segmentos };
  }

  private async actualizarEstado(libroId: number, estado: string): Promise<void> {
    await this.prisma.libro.update({ where: { id: BigInt(libroId) }, data: { estado } });
  }

  /**
   * Persiste unidades y segmentos en transacción con bulk inserts.
   */
  private async persistirUnidadesYSegmentosEnTx(
    libroId: number,
    unidades: UnidadConSegmentosDto[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const todosSegmentosData: Array<{
      libroId: bigint;
      unidadId: bigint;
      contenido: string;
      orden: bigint;
      numeroPagina: bigint | null;
      idExterno: string;
    }> = [];

    for (const u of unidades) {
      const unidad = await tx.unidad.create({
        data: { libroId: BigInt(libroId), nombre: u.nombre, orden: BigInt(u.orden) },
      });

      for (const s of u.segmentos) {
        todosSegmentosData.push({
          libroId: BigInt(libroId),
          unidadId: unidad.id,
          contenido: s.contenido,
          orden: BigInt(s.orden),
          numeroPagina: s.numeroPagina != null ? BigInt(s.numeroPagina) : null,
          idExterno: s.idExterno ?? '',
        });
      }
    }

    if (todosSegmentosData.length > 0) {
      await tx.segmento.createMany({ data: todosSegmentosData });
    }
  }

  /**
   * Marca el libro como error y guarda el mensaje.
   */
  async marcarError(libroId: number, mensaje: string): Promise<void> {
    await this.prisma.libro.update({
      where: { id: BigInt(libroId) },
      data: { estado: LIBRO_ESTADO.ERROR, mensajeError: mensaje },
    });
  }
}
