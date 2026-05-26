/**
 * ============================================
 * SERVICIO: LibrosService
 * ============================================
 * Carga de libros por admin: PDF → extracción → segmentación con unidades → BD.
 * Pipeline rediseñado: validación robusta, detección de capítulos, estados finos.
 */

import { Injectable, NotFoundException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LibroProcesamientoService } from './libro-procesamiento.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { LIBRO_ESTADO } from './constants/libro-estado.constants';
import { RedisService } from '../infra/redis/redis.service';
import { LIBROS_IMPORT_QUEUE, librosImportJobId } from '../queues/libros-import.constants';
import type { LibrosImportJobPayload } from '../queues/interfaces/libros-import-job.interface';
import { injectTraceContextForJob } from '../infra/telemetry/trace-context';
import { GlosarioSegmentoService } from './glosario-segmento.service';
import { textoAHtml } from '../common/utils/texto-html.utils';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class LibrosService {
  private readonly logger = new Logger(LibrosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly libroProcesamientoService: LibroProcesamientoService,
    private readonly uploadValidation: LibroUploadValidationService,
    private readonly librosPdfImagenesService: LibrosPdfImagenesService,
    private readonly pdfStorageService: SupabaseStorageService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly glosarioSegmentoService: GlosarioSegmentoService,
    @Optional()
    @InjectQueue(LIBROS_IMPORT_QUEUE)
    private readonly librosImportQueue?: Queue,
  ) {}

  /**
   * Cargar libro: validación robusta → extracción → segmentación con unidades reales → persistir.
   */
  async cargar(
    buffer: Buffer,
    dto: CargarLibroDto,
    auditContext?: AuditContext,
  ): Promise<{
    message: string;
    description?: string;
    data: any;
    async?: boolean;
    jobId?: string;
  }> {
    this.logger.log(
      `Intento de cargar libro: titulo="${dto?.titulo ?? '?'}", grado=${dto?.grado ?? '?'}, materiaId=${dto?.materiaId ?? 'null'}`,
    );

    await this.uploadValidation.validarBuffer(buffer);

    if (dto.materiaId != null) {
      const materia = await this.prisma.materia.findUnique({
        where: { id: BigInt(dto.materiaId) },
      });
      if (!materia) {
        throw new NotFoundException(`No se encontró la materia con ID ${dto.materiaId}`);
      }
    }

    const codigo = dto.codigo?.trim() || `LIB-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const existente = await this.prisma.libro.findFirst({ where: { codigo } });
    if (existente) {
      throw new ConflictException(
        'Ya existe un libro con ese código. Usa otro o deja codigo vacío para auto-generar.',
      );
    }

    const libro = await this.prisma.libro.create({
      data: {
        titulo: dto.titulo,
        materiaId: dto.materiaId != null ? BigInt(dto.materiaId) : null,
        codigo,
        grado: BigInt(dto.grado),
        autor: dto.autor ?? null,
        editorial: dto.editorial ?? null,
        descripcion: dto.descripcion ?? null,
        estado: LIBRO_ESTADO.PROCESANDO,
        numPaginas: null,
      },
    });
    this.logger.log(
      `Libro creado (procesando): id=${libro.id}, titulo="${libro.titulo}", codigo=${codigo}`,
    );

    const libroId = Number(libro.id);
    const useAsync = this.redisService.enabled && this.librosImportQueue != null;

    if (useAsync) {
      const rutaPdfRelativa = await this.pdfStorageService.guardar(buffer, libroId, codigo);
      const payload: LibrosImportJobPayload = {
        libroId,
        codigo,
        rutaPdfRelativa,
        auditContext,
        traceContext: injectTraceContextForJob(),
      };
      const job = await this.librosImportQueue!.add('import', payload, {
        jobId: librosImportJobId(libroId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 2000 },
      });
      const jobIdStr = job.id != null ? String(job.id) : '';
      await this.prisma.libro.update({
        where: { id: libro.id },
        data: { jobId: jobIdStr || null },
      });
      const data = await this.prisma.libro.findUnique({
        where: { id: libro.id },
        include: { materia: true, unidades: true },
      });
      return {
        message: 'Libro encolado para procesamiento.',
        description: `Job ${job.id}. Consulta GET /libros/${libroId}/estado`,
        jobId: jobIdStr,
        async: true,
        data,
      };
    }

    try {
      const resultado = await this.libroProcesamientoService.procesar({
        buffer,
        libroId,
        codigo,
        usarUnidadesReales: true,
      });

      const final = await this.prisma.libro.findUnique({
        where: { id: libro.id },
        include: { materia: true, unidades: true },
      });

      this.logger.log(
        `Libro cargado: id=${final!.id}, unidades=${resultado.numUnidades}, segmentos=${resultado.numSegmentos}`,
      );

      await this.auditService.log('libro_cargar', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: `${final!.titulo} (id: ${final!.id}, codigo: ${codigo})`,
      });

      return {
        message: 'Libro cargado y procesado correctamente.',
        description: `${resultado.numSegmentos} segmentos en ${resultado.numUnidades} ${resultado.numUnidades === 1 ? 'unidad' : 'unidades'} • ${resultado.numPaginas} páginas • PDF guardado`,
        data: final!,
      };
    } catch (e) {
      await this.libroProcesamientoService.marcarError(
        libroId,
        (e as Error)?.message ?? String(e),
      );
      this.logger.error(`Libro id=${libroId} falló: ${(e as Error)?.message ?? e}`);
      throw e;
    }
  }

  /**
   * Obtener estado actual del libro (para flujo async o debugging).
   */
  async obtenerEstado(id: number): Promise<{
    message: string;
    data: {
      id: number;
      titulo: string;
      estado: string;
      mensajeError?: string | null;
      jobId?: string | null;
      numPaginas?: number | null;
    };
  }> {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, titulo: true, estado: true, mensajeError: true, jobId: true, numPaginas: true },
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    return {
      message: 'Estado obtenido correctamente.',
      data: {
        id: Number(libro.id),
        titulo: libro.titulo,
        estado: libro.estado,
        mensajeError: libro.mensajeError,
        jobId: libro.jobId,
        numPaginas: libro.numPaginas != null ? Number(libro.numPaginas) : null,
      },
    };
  }

  /**
   * Listar libros con paginación.
   */
  async listar(
    page = 1,
    limit = 50,
  ): Promise<{
    message: string;
    total: number;
    data: any[];
    meta?: { page: number; limit: number; totalPages: number };
  }> {
    const total = await this.prisma.libro.count();
    const data = await this.prisma.libro.findMany({
      include: { materia: true },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.log(
      `GET /libros → page=${page}, limit=${limit}, total=${total}, returned=${data.length}`,
    );
    return {
      message: 'Libros obtenidos correctamente.',
      total,
      data,
      meta: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un libro por ID con unidades y segmentos (contenido listo para front).
   */
  async obtenerPorId(id: number) {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(id) },
      include: {
        materia: true,
        unidades: {
          include: { segmentos: true },
          orderBy: { orden: 'asc' },
        },
      },
    });

    if (!libro) {
      this.logger.warn(`GET /libros/${id} → Libro no encontrado`);
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }

    const numSegmentos =
      libro.unidades?.reduce((acc, u) => acc + (u.segmentos?.length ?? 0), 0) ?? 0;
    this.logger.log(
      `GET /libros/${id} → "${libro.titulo}", ${libro.unidades?.length ?? 0} unidades, ${numSegmentos} segmentos`,
    );

    for (const u of libro.unidades ?? []) {
      if (u.segmentos?.length) {
        (u.segmentos as any[]).sort((a, b) => Number(a.orden) - Number(b.orden));
      }
    }

    const preguntasVacias = {
      basico: [] as string[],
      intermedio: [] as string[],
      avanzado: [] as string[],
    };
    const idsSegmentos: number[] = [];
    for (const u of libro.unidades ?? []) {
      for (const seg of u.segmentos ?? []) {
        idsSegmentos.push(Number(seg.id));
      }
    }
    const mapaGlosario =
      await this.glosarioSegmentoService.obtenerMapaGlosarioPorSegmentos(idsSegmentos);

    for (const u of libro.unidades ?? []) {
      for (const seg of u.segmentos ?? []) {
        (seg as any).preguntas = preguntasVacias;
        (seg as any).glosario = mapaGlosario.get(Number(seg.id)) ?? [];
        (seg as any).contenidoHtml = textoAHtml((seg as any).contenido ?? '');
      }
    }

    return {
      message: 'Libro obtenido correctamente.',
      data: libro,
    };
  }

  /**
   * Elimina un libro por completo: asignaciones a escuelas, PDF en disco,
   * unidades, segmentos y el registro del libro.
   */
  async eliminar(id: number, auditContext?: AuditContext): Promise<{ message: string }> {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, titulo: true, codigo: true, rutaPdf: true },
    });

    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }

    await this.prisma.escuelaLibro.deleteMany({ where: { libroId: BigInt(id) } });
    await this.prisma.escuelaLibroPendiente.deleteMany({ where: { libroId: BigInt(id) } });

    if (libro.rutaPdf) {
      await this.pdfStorageService.eliminarArchivo(libro.rutaPdf);
    }
    if (libro.codigo) {
      await this.librosPdfImagenesService.eliminarImagenesLibro(id, libro.codigo);
    }

    await this.prisma.libro.delete({ where: { id: BigInt(id) } });

    this.logger.log(`Libro eliminado: id=${id}, titulo="${libro.titulo}"`);

    await this.auditService.log('libro_eliminar', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${libro.titulo} (id: ${id})`,
    });

    return {
      message: `Libro "${libro.titulo}" eliminado correctamente de todo el sistema.`,
    };
  }

  /**
   * Activar o desactivar un libro globalmente.
   * Si se desactiva, se desactiva también en todas las escuelas.
   */
  async setActivoGlobal(id: number, activo: boolean, auditContext?: AuditContext) {
    const libro = await this.prisma.libro.findUnique({ where: { id: BigInt(id) } });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    await this.prisma.libro.update({ where: { id: BigInt(id) }, data: { activo } });
    if (!activo) {
      await this.prisma.escuelaLibro.updateMany({ where: { libroId: BigInt(id) }, data: { activo: false } });
      this.logger.log(
        `Libro id=${id} desactivado globalmente; asignaciones en escuelas desactivadas.`,
      );
    }
    await this.auditService.log('libro_activo_global', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `libro id=${id}, activo=${activo}`,
    });
    return {
      message: activo
        ? 'Libro activado globalmente.'
        : 'Libro desactivado globalmente y en todas las escuelas.',
      data: { id: Number(libro.id), titulo: libro.titulo, activo },
    };
  }

  /**
   * Listar escuelas que tienen este libro.
   */
  async listarEscuelasDeLibro(libroId: number) {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(libroId) },
      select: { id: true, titulo: true, codigo: true },
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${libroId}`);
    }
    const asignaciones = await this.prisma.escuelaLibro.findMany({
      where: { libroId: BigInt(libroId) },
      include: { escuela: true },
      orderBy: { fechaInicio: 'desc' },
    });
    const data = asignaciones.map((a) => ({
      escuelaLibroId: Number(a.id),
      escuelaId: Number(a.escuelaId),
      nombreEscuela: a.escuela?.nombre ?? null,
      ciudad: a.escuela?.ciudad ?? null,
      estadoRegion: a.escuela?.estadoRegion ?? null,
      activoEnEscuela: a.activo,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
    }));
    return {
      message: 'Escuelas del libro obtenidas correctamente.',
      description: `Este libro está asignado a ${data.length} escuela(s). Activa o desactiva el acceso por escuela.`,
      libro: { id: Number(libro.id), titulo: libro.titulo, codigo: libro.codigo },
      total: data.length,
      data,
    };
  }

  /**
   * Activar o desactivar este libro en una escuela concreta.
   */
  async setLibroActivoEnEscuela(libroId: number, escuelaId: number, activo: boolean) {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(libroId) },
      select: { id: true, titulo: true },
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${libroId}`);
    }
    const el = await this.prisma.escuelaLibro.findFirst({
      where: { libroId: BigInt(libroId), escuelaId: BigInt(escuelaId) },
      include: { escuela: true },
    });
    if (!el) {
      throw new NotFoundException(
        `El libro con ID ${libroId} no está asignado a la escuela con ID ${escuelaId}.`,
      );
    }
    await this.prisma.escuelaLibro.update({ where: { id: el.id }, data: { activo } });
    this.logger.log(`Libro ${libroId} / escuela ${escuelaId}: activo=${activo}.`);
    return {
      message: activo
        ? 'Libro activado para esta escuela.'
        : 'Libro desactivado para esta escuela.',
      data: {
        libroId,
        escuelaId,
        activo,
        tituloLibro: libro.titulo,
        nombreEscuela: el.escuela?.nombre,
      },
    };
  }

  /**
   * Verifica si un libro está asignado a una escuela (para alumnos).
   */
  async libroPerteneceAEscuela(libroId: number, escuelaId: number): Promise<boolean> {
    const el = await this.prisma.escuelaLibro.findFirst({
      where: { libroId: BigInt(libroId), escuelaId: BigInt(escuelaId), activo: true },
      include: { libro: true },
    });
    return !!(el && el.libro?.activo !== false);
  }

  /**
   * Obtiene id y codigo del libro (para servir imágenes de páginas).
   */
  async obtenerLibroBasico(id: number): Promise<{ id: number; codigo: string }> {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, codigo: true },
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    return { id: Number(libro.id), codigo: libro.codigo };
  }

  /**
   * Obtiene la URL pública del PDF guardado para un libro.
   */
  async obtenerUrlPdf(id: number): Promise<string | null> {
    const libro = await this.prisma.libro.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, rutaPdf: true },
    });
    if (!libro?.rutaPdf) return null;
    return this.pdfStorageService.obtenerUrl(libro.rutaPdf);
  }
}
