/**
 * ============================================
 * SERVICIO: LibrosService
 * ============================================
 * Carga de libros por admin: PDF → extracción → segmentos → BD.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { Materia } from '../personas/entities/materia.entity';
import { LibrosPdfService } from './libros-pdf.service';
import type { SegmentoDto } from './libros-pdf.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LibrosService {
  constructor(
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
    @InjectRepository(Unidad)
    private readonly unidadRepository: Repository<Unidad>,
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectRepository(Materia)
    private readonly materiaRepository: Repository<Materia>,
    private readonly librosPdfService: LibrosPdfService,
  ) {}

  /**
   * Cargar libro: PDF + metadatos. Extrae texto, limpia, segmenta, persiste.
   */
  async cargar(
    buffer: Buffer,
    dto: CargarLibroDto,
  ): Promise<{ message: string; description?: string; data: Libro }> {
    console.log(`📚 Intento de cargar libro: titulo="${dto?.titulo ?? '?'}", grado=${dto?.grado ?? '?'}, materiaId=${dto?.materiaId ?? 'null'}`);
    if (!buffer || buffer.length < 100) {
      throw new BadRequestException('Archivo PDF inválido o vacío.');
    }

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
      dto.codigo?.trim() ||
      `LIB-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const existente = await this.libroRepository.findOne({
      where: { codigo },
    });
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
      descripcion: dto.descripcion ?? null,
      estado: 'procesando',
      numPaginas: null,
    });
    await this.libroRepository.save(libro);
    console.log(`📚 Libro creado (procesando): id=${libro.id}, titulo="${libro.titulo}", codigo=${codigo}`);

    try {
      const { numPaginas, segmentos } =
        await this.librosPdfService.procesarPdf(buffer);

      const unidadEnt = this.unidadRepository.create({
        libroId: libro.id,
        nombre: 'Unidad 1',
        orden: 1,
      });
      await this.unidadRepository.save(unidadEnt);

      const entidades = segmentos.map((s: SegmentoDto) =>
        this.segmentoRepository.create({
          libroId: libro.id,
          unidadId: unidadEnt.id,
          contenido: s.contenido,
          orden: s.orden,
          numeroPagina: s.numeroPagina,
          idExterno: s.idExterno,
        }),
      );
      await this.segmentoRepository.save(entidades);

      libro.estado = 'listo';
      libro.numPaginas = numPaginas;
      await this.libroRepository.save(libro);

      const saved = await this.libroRepository.findOne({
        where: { id: libro.id },
        relations: ['materia', 'unidades'],
      });

      console.log(`✅ Libro cargado y listo: id=${saved.id}, titulo="${saved.titulo}", segmentos=${segmentos.length}, paginas=${numPaginas}`);

      return {
        message: 'Libro cargado y procesado correctamente.',
        description: `Se extrajeron ${segmentos.length} segmentos de ${numPaginas} páginas. Estado: listo.`,
        data: saved,
      };
    } catch (e) {
      libro.estado = 'error';
      await this.libroRepository.save(libro);
      console.log(`❌ Libro id=${libro.id} falló al procesar PDF. Estado → error.`, e?.message ?? e);
      throw e;
    }
  }

  /**
   * Listar todos los libros.
   */
  async listar(): Promise<{ message: string; total: number; data: Libro[] }> {
    const data = await this.libroRepository.find({
      order: { id: 'DESC' },
      relations: ['materia'],
    });
    console.log(`📋 GET /libros → ${data.length} libros. IDs: ${data.map((l) => l.id).join(', ') || '(ninguno)'}`);
    return {
      message: 'Libros obtenidos correctamente.',
      total: data.length,
      data,
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
      console.log(`❌ GET /libros/${id} → Libro no encontrado`);
      throw new NotFoundException(`No se encontró el libro con ID ${id}`);
    }

    const numSegmentos = libro.unidades?.reduce((acc, u) => acc + (u.segmentos?.length ?? 0), 0) ?? 0;
    console.log(`📖 GET /libros/${id} → "${libro.titulo}", ${libro.unidades?.length ?? 0} unidades, ${numSegmentos} segmentos`);

    if (libro.unidades?.length) {
      libro.unidades.sort((a, b) => Number(a.orden) - Number(b.orden));
      for (const u of libro.unidades) {
        if (u.segmentos?.length) {
          u.segmentos.sort((a, b) => Number(a.orden) - Number(b.orden));
        }
      }
    }

    return {
      message: 'Libro obtenido correctamente.',
      data: libro,
    };
  }
}
