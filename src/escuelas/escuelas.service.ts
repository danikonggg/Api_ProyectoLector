/**
 * ============================================
 * SERVICIO: EscuelasService
 * ============================================
 * 
 * Servicio que maneja las operaciones CRUD de escuelas.
 * Solo los administradores pueden gestionar escuelas.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escuela } from '../personas/entities/escuela.entity';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';

@Injectable()
export class EscuelasService {
  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
  ) {}

  /**
   * Crear una nueva escuela
   */
  async crear(crearEscuelaDto: CrearEscuelaDto) {
    console.log(`📝 Intento de creación de escuela: ${crearEscuelaDto.nombre}`);

    // Verificar si ya existe una escuela con el mismo nombre
    const escuelaExistente = await this.escuelaRepository.findOne({
      where: { nombre: crearEscuelaDto.nombre },
    });

    if (escuelaExistente) {
      console.log(`❌ Creación fallida: Escuela con nombre duplicado - ${crearEscuelaDto.nombre}`);
      throw new ConflictException('Ya existe una escuela con ese nombre');
    }

    // Si se proporciona clave, verificar que no esté duplicada
    if (crearEscuelaDto.clave) {
      const escuelaConClave = await this.escuelaRepository.findOne({
        where: { clave: crearEscuelaDto.clave },
      });

      if (escuelaConClave) {
        console.log(`❌ Creación fallida: Escuela con clave duplicada - ${crearEscuelaDto.clave}`);
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    // Crear la escuela
    const escuela = this.escuelaRepository.create({
      nombre: crearEscuelaDto.nombre,
      nivel: crearEscuelaDto.nivel,
      clave: crearEscuelaDto.clave || null,
      direccion: crearEscuelaDto.direccion || null,
      telefono: crearEscuelaDto.telefono || null,
    });

    const escuelaGuardada = await this.escuelaRepository.save(escuela);

    console.log(`✅ Escuela creada exitosamente: ${escuelaGuardada.nombre} - ID: ${escuelaGuardada.id}`);

    return {
      message: 'Escuela creada exitosamente',
      description: 'La escuela ha sido registrada correctamente en el sistema.',
      data: escuelaGuardada,
    };
  }

  /**
   * Obtener todas las escuelas
   */
  async obtenerTodas() {
    const escuelas = await this.escuelaRepository.find({
      order: { nombre: 'ASC' },
    });

    console.log(`📋 Consulta de escuelas: ${escuelas.length} encontradas`);

    return {
      message: 'Escuelas obtenidas exitosamente',
      description: `Se encontraron ${escuelas.length} escuela(s) en el sistema`,
      total: escuelas.length,
      data: escuelas,
    };
  }

  /**
   * Obtener una escuela por ID
   */
  async obtenerPorId(id: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id },
      relations: ['alumnos', 'maestros'],
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    return {
      message: 'Escuela obtenida exitosamente',
      description: 'La escuela fue encontrada en el sistema',
      data: escuela,
    };
  }

  /**
   * Actualizar una escuela
   */
  async actualizar(id: number, actualizarEscuelaDto: ActualizarEscuelaDto) {
    console.log(`📝 Intento de actualización de escuela ID: ${id}`);

    const escuela = await this.escuelaRepository.findOne({
      where: { id },
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    // Verificar si el nuevo nombre ya existe (si se está cambiando)
    if (actualizarEscuelaDto.nombre && actualizarEscuelaDto.nombre !== escuela.nombre) {
      const escuelaConNombre = await this.escuelaRepository.findOne({
        where: { nombre: actualizarEscuelaDto.nombre },
      });

      if (escuelaConNombre) {
        throw new ConflictException('Ya existe una escuela con ese nombre');
      }
    }

    // Verificar si la nueva clave ya existe (si se está cambiando)
    if (actualizarEscuelaDto.clave && actualizarEscuelaDto.clave !== escuela.clave) {
      const escuelaConClave = await this.escuelaRepository.findOne({
        where: { clave: actualizarEscuelaDto.clave },
      });

      if (escuelaConClave) {
        throw new ConflictException('Ya existe una escuela con esa clave');
      }
    }

    // Actualizar los campos
    Object.assign(escuela, actualizarEscuelaDto);

    const escuelaActualizada = await this.escuelaRepository.save(escuela);

    console.log(`✅ Escuela actualizada exitosamente: ${escuelaActualizada.nombre} - ID: ${escuelaActualizada.id}`);

    return {
      message: 'Escuela actualizada exitosamente',
      description: 'La información de la escuela ha sido actualizada correctamente.',
      data: escuelaActualizada,
    };
  }

  /**
   * Eliminar una escuela
   */
  async eliminar(id: number) {
    console.log(`🗑️ Intento de eliminación de escuela ID: ${id}`);

    const escuela = await this.escuelaRepository.findOne({
      where: { id },
      relations: ['alumnos', 'maestros'],
    });

    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${id}`);
    }

    // Verificar si tiene alumnos o maestros asociados
    if (escuela.alumnos && escuela.alumnos.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la escuela porque tiene ${escuela.alumnos.length} alumno(s) asociado(s)`,
      );
    }

    if (escuela.maestros && escuela.maestros.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la escuela porque tiene ${escuela.maestros.length} maestro(s) asociado(s)`,
      );
    }

    await this.escuelaRepository.remove(escuela);

    console.log(`✅ Escuela eliminada exitosamente: ${escuela.nombre} - ID: ${id}`);

    return {
      message: 'Escuela eliminada exitosamente',
      description: 'La escuela ha sido eliminada del sistema.',
    };
  }

  /**
   * Verificar si una escuela existe (método interno para otros servicios)
   */
  async existe(id: number): Promise<boolean> {
    const escuela = await this.escuelaRepository.findOne({
      where: { id },
    });
    return !!escuela;
  }

  /**
   * Obtener una escuela sin relaciones (método interno)
   */
  async obtenerUna(id: number): Promise<Escuela | null> {
    return await this.escuelaRepository.findOne({
      where: { id },
    });
  }
}
