/**
 * ============================================
 * SERVICIO: LibrosService
 * ============================================
 * Carga de libros por admin: PDF → extracción → segmentación con unidades → BD.
 * Pipeline rediseñado: validación robusta, detección de capítulos, estados finos.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { Materia } from '../personas/entities/materia.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from '../escuelas/entities/escuela-libro-pendiente.entity';
import { LibroProcesamientoService } from './libro-procesamiento.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { PdfStorageService } from './pdf-storage.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { LIBRO_ESTADO } from './constants/libro-estado.constants';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class LibrosService {
  private readonly logger = new Logger(LibrosService.name);

  constructor(
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
    @InjectRepository(Unidad)
    private readonly unidadRepository: Repository<Unidad>,
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectRepository(Materia)
    private readonly materiaRepository: Repository<Materia>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepository: Repository<EscuelaLibro>,
    @InjectRepository(EscuelaLibroPendiente)
    private readonly escuelaLibroPendienteRepository: Repository<EscuelaLibroPendiente>,
    private readonly libroProcesamientoService: LibroProcesamientoService,
    private readonly uploadValidation: LibroUploadValidationService,
    private readonly librosPdfImagenesService: LibrosPdfImagenesService,
    private readonly pdfStorageService: PdfStorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cargar libro: validación robusta → extracción → segmentación con unidades reales → persistir.
   */
  async cargar(
    buffer: Buffer,
    dto: CargarLibroDto,
    auditContext?: AuditContext,
  ): Promise<{ message: string; description?: string; data: Libro }> {
    this.logger.log(
      `Intento de cargar libro: titulo="${dto?.titulo ?? '?'}", grado=${dto?.grado ?? '?'}, materiaId=${dto?.materiaId ?? 'null'}`,
    );

    await this.uploadValidation.validarBuffer(buffer);

    if (dto.materiaId != null) {
      const materia = await this.materiaRepository.findOne({
        where: { id: dto.materiaId },
      });
      if (!materia) {
        throw new NotFoundException(
          `No se encontró la materia con ID ${dto.materiaId}`,
        );
      }
    }

    const codigo =
      dto.codigo?.trim() || `LIB-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const existente = await this.libroRepository.findOne({ where: { codigo } });
    if (existente) {
      throw new ConflictException(
        'Ya existe un libro con ese código. Usa otro o deja codigo vacío para auto-generar.',
      );
    }

    const libro = this.libroRepository.create({
      titulo: dto.titulo,
      materiaId: dto.materiaId ?? null,
      codigo,
      grado: dto.grado,
      autor: dto.autor ?? null,
      editorial: dto.editorial ?? null,
      descripcion: dto.descripcion ?? null,
      estado: LIBRO_ESTADO.PROCESANDO,
      numPaginas: null,
    });
    await this.libroRepository.save(libro);
    this.logger.log(
      `Libro creado (procesando): id=${libro.id}, titulo="${libro.titulo}", codigo=${codigo}`,
    );

    try {
      const resultado = await this.libroProcesamientoService.procesar({
        buffer,
        libroId: libro.id,
        codigo,
        usarUnidadesReales: true,
      });

      const saved = await this.libroRepository.findOne({
        where: { id: libro.id },
        relations: ['materia', 'unidades'],
      });

      this.logger.log(
        `Libro cargado: id=${saved.id}, unidades=${resultado.numUnidades}, segmentos=${resultado.numSegmentos}`,
      );

      await this.libroRepository.update(libro.id, { estado: LIBRO_ESTADO.LISTO });
      const final = await this.libroRepository.findOne({
        where: { id: libro.id },
        relations: ['materia', 'unidades'],
      });

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
        libro.id,
        (e as Error)?.message ?? String(e),
      );
      this.logger.error(
        `Libro id=${libro.id} falló: ${(e as Error)?.message ?? e}`,
      );
      throw e;
    }
  }

  /**
   * Obtener estado actual del libro (para flujo async o debugging).
   */
  async obtenerEstado(
    id: number,
  ): Promise<{
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
    const libro = await this.libroRepository.findOne({
      where: { id },
      select: ['id', 'titulo', 'estado', 'mensajeError', 'jobId', 'numPaginas'],
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    return {
      message: 'Estado obtenido correctamente.',
      data: {
        id: libro.id,
        titulo: libro.titulo,
        estado: libro.estado,
        mensajeError: libro.mensajeError,
        jobId: libro.jobId,
        numPaginas: libro.numPaginas,
      },
    };
  }

  /**
   * Listar libros con paginación.
   */
  async listar(page = 1, limit = 50): Promise<{
    message: string;
    total: number;
    data: Libro[];
    meta?: { page: number; limit: number; totalPages: number };
  }> {
    const qb = this.libroRepository
      .createQueryBuilder('libro')
      .leftJoinAndSelect('libro.materia', 'materia')
      .orderBy('libro.id', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    this.logger.log(`GET /libros → page=${page}, limit=${limit}, total=${total}, returned=${data.length}`);
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
    const libro = await this.libroRepository.findOne({
      where: { id },
      relations: ['materia', 'unidades', 'unidades.segmentos'],
    });

    if (!libro) {
      this.logger.warn(`GET /libros/${id} → Libro no encontrado`);
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }

    const numSegmentos = libro.unidades?.reduce((acc, u) => acc + (u.segmentos?.length ?? 0), 0) ?? 0;
    this.logger.log(`GET /libros/${id} → "${libro.titulo}", ${libro.unidades?.length ?? 0} unidades, ${numSegmentos} segmentos`);

    if (libro.unidades?.length) {
      libro.unidades.sort((a, b) => Number(a.orden) - Number(b.orden));
      for (const u of libro.unidades) {
        if (u.segmentos?.length) {
          u.segmentos.sort((a, b) => Number(a.orden) - Number(b.orden));
        }
      }
    }

    // Preguntas por segmento desactivadas (se agregarán después)
    const preguntasVacias = { basico: [] as string[], intermedio: [] as string[], avanzado: [] as string[] };
    for (const u of libro.unidades ?? []) {
      for (const seg of u.segmentos ?? []) {
        (seg as Segmento & { preguntas?: object }).preguntas = preguntasVacias;
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
    const libro = await this.libroRepository.findOne({
      where: { id },
      select: ['id', 'titulo', 'codigo', 'rutaPdf'],
    });

    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }

    await this.escuelaLibroRepository.delete({ libroId: id });
    await this.escuelaLibroPendienteRepository.delete({ libroId: id });

    if (libro.rutaPdf) {
      await this.pdfStorageService.eliminarArchivo(libro.rutaPdf);
    }
    if (libro.codigo) {
      await this.librosPdfImagenesService.eliminarImagenesLibro(id, libro.codigo);
    }

    await this.libroRepository.delete(id);

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
   * Si se desactiva, se desactiva también en todas las escuelas (Escuela_Libro.activo = false).
   */
  async setActivoGlobal(id: number, activo: boolean, auditContext?: AuditContext) {
    const libro = await this.libroRepository.findOne({ where: { id } });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    libro.activo = activo;
    await this.libroRepository.save(libro);
    if (!activo) {
      await this.escuelaLibroRepository.update({ libroId: id }, { activo: false });
      this.logger.log(`Libro id=${id} desactivado globalmente; asignaciones en escuelas desactivadas.`);
    }
    await this.auditService.log('libro_activo_global', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `libro id=${id}, activo=${activo}`,
    });
    return {
      message: activo ? 'Libro activado globalmente.' : 'Libro desactivado globalmente y en todas las escuelas.',
      data: { id: libro.id, titulo: libro.titulo, activo: libro.activo },
    };
  }

  /**
   * Listar escuelas que tienen este libro (para gestionar desde la pantalla del libro).
   * Devuelve todas las asignaciones con activoEnEscuela para poder asignar/desasignar desde el front de libros.
   */
  async listarEscuelasDeLibro(libroId: number) {
    const libro = await this.libroRepository.findOne({
      where: { id: libroId },
      select: ['id', 'titulo', 'codigo'],
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${libroId}`);
    }
    const asignaciones = await this.escuelaLibroRepository.find({
      where: { libroId },
      relations: ['escuela'],
      order: { fechaInicio: 'DESC' },
    });
    const data = asignaciones.map((a) => ({
      escuelaLibroId: a.id,
      escuelaId: a.escuelaId,
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
      libro: { id: libro.id, titulo: libro.titulo, codigo: libro.codigo },
      total: data.length,
      data,
    };
  }

  /**
   * Activar o desactivar este libro en una escuela concreta (desde la pantalla del libro).
   */
  async setLibroActivoEnEscuela(libroId: number, escuelaId: number, activo: boolean) {
    const libro = await this.libroRepository.findOne({ where: { id: libroId }, select: ['id', 'titulo'] });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${libroId}`);
    }
    const el = await this.escuelaLibroRepository.findOne({
      where: { libroId, escuelaId },
      relations: ['escuela'],
    });
    if (!el) {
      throw new NotFoundException(
        `El libro con ID ${libroId} no está asignado a la escuela con ID ${escuelaId}.`,
      );
    }
    el.activo = activo;
    await this.escuelaLibroRepository.save(el);
    this.logger.log(`Libro ${libroId} / escuela ${escuelaId}: activo=${activo}.`);
    return {
      message: activo ? 'Libro activado para esta escuela.' : 'Libro desactivado para esta escuela.',
      data: { libroId, escuelaId, activo, tituloLibro: libro.titulo, nombreEscuela: el.escuela?.nombre },
    };
  }

  /**
   * Verifica si un libro está asignado a una escuela (para alumnos).
   * Considera libro.activo global y EscuelaLibro.activo.
   */
  async libroPerteneceAEscuela(libroId: number, escuelaId: number): Promise<boolean> {
    const el = await this.escuelaLibroRepository.findOne({
      where: { libroId, escuelaId, activo: true },
      relations: ['libro'],
    });
    return !!(el && el.libro?.activo !== false);
  }

  /**
   * Obtiene id y codigo del libro (para servir imágenes de páginas).
   */
  async obtenerLibroBasico(id: number): Promise<{ id: number; codigo: string }> {
    const libro = await this.libroRepository.findOne({
      where: { id },
      select: ['id', 'codigo'],
    });
    if (!libro) {
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }
    return { id: libro.id, codigo: libro.codigo };
  }

  /**
   * Obtiene la ruta absoluta del PDF guardado para un libro (para streaming).
   */
  async rutaPdfAbsoluta(id: number): Promise<string | null> {
    const libro = await this.libroRepository.findOne({
      where: { id },
      select: ['id', 'rutaPdf'],
    });
    if (!libro?.rutaPdf) return null;
    return this.pdfStorageService.rutaAbsoluta(libro.rutaPdf);
  }
}
