/**
 * ============================================
 * SERVICIO: Orquestación del procesamiento de libros
 * ============================================
 * Lógica pura de procesamiento: extracción, segmentación con unidades,
 * guardado. Usa transacciones para atomicidad y bulk inserts para rendimiento.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { LibrosPdfService } from './libros-pdf.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { PdfStorageService } from './pdf-storage.service';
import type {
  UnidadConSegmentosDto,
  SegmentoDto,
} from './libros-pdf.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { LIBRO_ESTADO } from './constants/libro-estado.constants';

export interface ProcesarLibroInput {
  buffer: Buffer;
  libroId: number;
  codigo: string;
  usarUnidadesReales?: boolean; // true = detectar capítulos; false = "Unidad 1"
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
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
    @InjectRepository(Unidad)
    private readonly unidadRepository: Repository<Unidad>,
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly librosPdfService: LibrosPdfService,
    private readonly librosPdfImagenesService: LibrosPdfImagenesService,
    private readonly pdfStorageService: PdfStorageService,
    private readonly uploadValidation: LibroUploadValidationService,
  ) {}

  /**
   * Ejecuta el pipeline completo de procesamiento.
   * 1. Extracción y segmentación en memoria
   * 2. Guarda PDF en disco
   * 3. Transacción: bulk insert unidades + segmentos + actualiza libro
   */
  async procesar(input: ProcesarLibroInput): Promise<ProcesarLibroResult> {
    const { buffer, libroId, codigo, usarUnidadesReales = true } = input;

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

    const numSegmentos = unidades.reduce(
      (acc, u) => acc + (u.segmentos?.length ?? 0),
      0,
    );

    await this.actualizarEstado(libroId, LIBRO_ESTADO.GUARDANDO);

    // Guardar PDF primero (I/O); si falla, no tocamos BD
    const rutaPdf = await this.pdfStorageService.guardar(buffer, libroId, codigo);

    try {
      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.persistirUnidadesYSegmentosEnTx(libroId, unidades, manager);
        await manager.update(Libro, libroId, {
          estado: LIBRO_ESTADO.LISTO,
          numPaginas: resultado.numPaginas,
          rutaPdf,
        });
      });
    } catch (e) {
      await this.pdfStorageService.eliminarArchivo(rutaPdf);
      throw e;
    }

    // Generar imágenes de cada página (captura por página) para visualización tipo "mismo libro"
    try {
      await this.librosPdfImagenesService.guardarPaginasParaLibro(buffer, libroId, codigo);
    } catch (err) {
      this.logger.warn(`Imágenes del libro ${libroId} no generadas: ${(err as Error)?.message ?? err}`);
    }

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
    await this.libroRepository.update(libroId, { estado });
  }

  /**
   * Persiste unidades y segmentos en transacción con bulk inserts (mejor rendimiento).
   */
  private async persistirUnidadesYSegmentosEnTx(
    libroId: number,
    unidades: UnidadConSegmentosDto[],
    manager: EntityManager,
  ): Promise<void> {
    const unidadesRepo = manager.getRepository(Unidad);
    const segmentosRepo = manager.getRepository(Segmento);

    const entidadesUnidad = unidades.map((u) =>
      unidadesRepo.create({ libroId, nombre: u.nombre, orden: u.orden }),
    );
    const savedUnidades = await unidadesRepo.save(entidadesUnidad);

    const todosSegmentos: Partial<Segmento>[] = [];
    for (let i = 0; i < savedUnidades.length; i++) {
      const unidad = savedUnidades[i]!;
      const dto = unidades[i]!;
      for (const s of dto.segmentos) {
        todosSegmentos.push(
          segmentosRepo.create({
            libroId,
            unidadId: unidad.id,
            contenido: s.contenido,
            orden: s.orden,
            numeroPagina: s.numeroPagina,
            idExterno: s.idExterno,
          }),
        );
      }
    }
    if (todosSegmentos.length > 0) {
      await segmentosRepo.save(todosSegmentos);
    }
  }

  /**
   * Marca el libro como error y guarda el mensaje.
   */
  async marcarError(libroId: number, mensaje: string): Promise<void> {
    await this.libroRepository.update(libroId, {
      estado: LIBRO_ESTADO.ERROR,
      mensajeError: mensaje,
    });
  }
}
