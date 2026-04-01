/**
 * Servicio de Materias.
 * CRUD de materias para usar en Alumno_Maestro y Libros.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Materia } from '../personas/entities/materia.entity';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';

@Injectable()
export class MateriasService {
  constructor(
    @InjectRepository(Materia)
    private readonly materiaRepository: Repository<Materia>,
  ) {}

  /**
   * Listar todas las materias.
   */
  async findAll() {
    const materias = await this.materiaRepository.find({
      order: { nombre: 'ASC' },
    });
    return {
      message: 'Materias obtenidas correctamente',
      total: materias.length,
      data: materias,
    };
  }

  /**
   * Obtener una materia por ID.
   */
  async findOne(id: number) {
    const materia = await this.materiaRepository.findOne({ where: { id } });
    if (!materia) {
      throw new NotFoundException(`No se encontró la materia con ID ${id}`);
    }
    return {
      message: 'Materia encontrada',
      data: materia,
    };
  }

  /**
   * Crear una materia. Solo admin.
   */
  async create(dto: CreateMateriaDto) {
    const existente = await this.materiaRepository.findOne({
      where: { nombre: dto.nombre.trim() },
    });
    if (existente) {
      throw new ConflictException(`Ya existe una materia con el nombre "${dto.nombre}"`);
    }

    const materia = this.materiaRepository.create({
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      nivel: dto.nivel?.trim() || null,
    });
    const guardada = await this.materiaRepository.save(materia);

    return {
      message: 'Materia creada correctamente',
      data: guardada,
    };
  }

  /**
   * Actualizar una materia. Solo admin.
   */
  async update(id: number, dto: UpdateMateriaDto) {
    const materia = await this.materiaRepository.findOne({ where: { id } });
    if (!materia) {
      throw new NotFoundException(`No se encontró la materia con ID ${id}`);
    }

    if (dto.nombre != null) {
      const existente = await this.materiaRepository.findOne({
        where: { nombre: dto.nombre.trim() },
      });
      if (existente && existente.id !== id) {
        throw new ConflictException(`Ya existe una materia con el nombre "${dto.nombre}"`);
      }
      materia.nombre = dto.nombre.trim();
    }
    if (dto.descripcion !== undefined) materia.descripcion = dto.descripcion?.trim() || null;
    if (dto.nivel !== undefined) materia.nivel = dto.nivel?.trim() || null;

    const guardada = await this.materiaRepository.save(materia);
    return {
      message: 'Materia actualizada correctamente',
      data: guardada,
    };
  }

  /**
   * Eliminar una materia. Solo admin.
   * Nota: Si la materia está en uso (Alumno_Maestro, Libro, etc.), puede fallar por FK.
   */
  async remove(id: number) {
    const materia = await this.materiaRepository.findOne({ where: { id } });
    if (!materia) {
      throw new NotFoundException(`No se encontró la materia con ID ${id}`);
    }

    await this.materiaRepository.remove(materia);
    return {
      message: 'Materia eliminada correctamente',
    };
  }
}
