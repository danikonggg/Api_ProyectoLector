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
import { EscuelaLibro } from './entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from './entities/escuela-libro-pendiente.entity';
import { Libro } from '../libros/entities/libro.entity';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';

@Injectable()
export class EscuelasService {
  constructor(
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectRepository(EscuelaLibro)
    private readonly escuelaLibroRepository: Repository<EscuelaLibro>,
    @InjectRepository(EscuelaLibroPendiente)
    private readonly escuelaLibroPendienteRepository: Repository<EscuelaLibroPendiente>,
    @InjectRepository(Libro)
    private readonly libroRepository: Repository<Libro>,
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

  /**
   * PASO 1 - Admin otorga un libro a una escuela.
   * Crea registro pendiente. El libro NO aparece en la escuela hasta que ella canjee.
   */
  async otorgarLibroPorCodigo(escuelaId: number, codigo: string) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const libro = await this.libroRepository.findOne({
      where: { codigo: codigo.trim() },
    });
    if (!libro) {
      throw new NotFoundException(
        `No se encontró ningún libro con código "${codigo}". Verifica el código en la lista de libros.`,
      );
    }

    // Ya canjeado = ya está en Escuela_Libro
    const yaCanjeado = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaCanjeado) {
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya está activo en esta escuela (ya fue canjeado).`,
      );
    }

    // Ya otorgado pendiente de canje
    const yaPendiente = await this.escuelaLibroPendienteRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaPendiente) {
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya fue otorgado a esta escuela. La escuela debe canjear el código.`,
      );
    }

    const pendiente = this.escuelaLibroPendienteRepository.create({
      escuelaId,
      libroId: libro.id,
    });
    await this.escuelaLibroPendienteRepository.save(pendiente);

    console.log(
      `✅ Libro otorgado (pendiente de canje): "${libro.titulo}" (${codigo}) → escuela ID ${escuelaId}`,
    );

    return {
      message: 'Libro otorgado a la escuela correctamente.',
      description: `El libro "${libro.titulo}" (código ${codigo}) está disponible para que la escuela lo canjee. La escuela debe introducir el código para activarlo.`,
      data: {
        pendienteId: pendiente.id,
        escuelaId,
        libroId: libro.id,
        codigo: libro.codigo,
        titulo: libro.titulo,
        estado: 'pendiente_de_canje',
      },
    };
  }

  /**
   * PASO 2 - La escuela (director) canjea el código.
   * Solo funciona si el admin ya otorgó ese libro a la escuela.
   * Crea Escuela_Libro y elimina el pendiente.
   */
  async canjearLibroPorCodigo(escuelaId: number, codigo: string) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const libro = await this.libroRepository.findOne({
      where: { codigo: codigo.trim() },
    });
    if (!libro) {
      throw new NotFoundException(
        `No se encontró ningún libro con código "${codigo}". Verifica el código.`,
      );
    }

    // Verificar que el admin otorgó este libro a esta escuela
    const pendiente = await this.escuelaLibroPendienteRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (!pendiente) {
      throw new BadRequestException(
        `Este libro (código ${codigo}) no ha sido otorgado a tu escuela por el administrador. Solicita que te asignen el libro primero.`,
      );
    }

    // Ya no debe existir en Escuela_Libro (por si acaso)
    const yaActivo = await this.escuelaLibroRepository.findOne({
      where: { escuelaId, libroId: libro.id },
    });
    if (yaActivo) {
      await this.escuelaLibroPendienteRepository.remove(pendiente);
      throw new ConflictException(
        `El libro "${libro.titulo}" (${codigo}) ya está activo en tu escuela.`,
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const el = this.escuelaLibroRepository.create({
      escuelaId,
      libroId: libro.id,
      activo: true,
      fechaInicio: hoy,
      fechaFin: null,
    });
    await this.escuelaLibroRepository.save(el);
    await this.escuelaLibroPendienteRepository.remove(pendiente);

    console.log(
      `✅ Libro canjeado: "${libro.titulo}" (${codigo}) → escuela ID ${escuelaId}`,
    );

    return {
      message: 'Libro canjeado correctamente.',
      description: `El libro "${libro.titulo}" ya está activo en tu escuela.`,
      data: {
        escuelaLibroId: el.id,
        escuelaId,
        libroId: libro.id,
        codigo: libro.codigo,
        titulo: libro.titulo,
        fechaInicio: el.fechaInicio,
      },
    };
  }

  /**
   * Listar libros pendientes de canjear (otorgados por admin, aún no canjeados por la escuela).
   * Director: solo ve título y grado (no código) para que no pueda copiarlo sin que el admin se lo entregue.
   * Admin: ve toda la información incluyendo el código.
   */
  async listarLibrosPendientesDeEscuela(escuelaId: number, paraDirector = false) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const pendientes = await this.escuelaLibroPendienteRepository.find({
      where: { escuelaId },
      relations: ['libro', 'libro.materia'],
      order: { fechaOtorgado: 'DESC' },
    });

    const libros = pendientes.map((p) => {
      if (paraDirector) {
        // Director: solo nombre y grado. Sin código ni ids sensibles.
        return {
          titulo: p.libro.titulo,
          grado: p.libro.grado,
          fechaOtorgado: p.fechaOtorgado,
        };
      }
      // Admin: información completa
      return {
        ...p.libro,
        fechaOtorgado: p.fechaOtorgado,
        pendienteId: p.id,
      };
    });

    return {
      message: 'Libros pendientes de canjear obtenidos correctamente.',
      description: paraDirector
        ? `Hay ${libros.length} libro(s) pendientes de canjear. Solicita el código al administrador para activarlos.`
        : `Hay ${libros.length} libro(s) otorgados pendientes de canjear.`,
      total: libros.length,
      data: libros,
    };
  }

  /**
   * Listar maestros de una escuela.
   */
  async listarMaestrosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
      relations: ['maestros', 'maestros.persona'],
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const maestros = (escuela.maestros || []).map((m) => ({
      id: m.id,
      personaId: m.personaId,
      escuelaId: m.escuelaId,
      especialidad: m.especialidad,
      fechaContratacion: m.fechaContratacion,
      persona: m.persona
        ? {
            id: m.persona.id,
            nombre: m.persona.nombre,
            apellido: m.persona.apellido,
            correo: m.persona.correo,
            telefono: m.persona.telefono,
          }
        : null,
    }));
    return {
      message: 'Maestros de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${maestros.length} maestro(s).`,
      total: maestros.length,
      data: maestros,
    };
  }

  /**
   * Listar alumnos de una escuela.
   */
  async listarAlumnosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
      relations: ['alumnos', 'alumnos.persona'],
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }
    const alumnos = (escuela.alumnos || []).map((a) => ({
      id: a.id,
      personaId: a.personaId,
      escuelaId: a.escuelaId,
      grado: a.grado,
      grupo: a.grupo,
      cicloEscolar: a.cicloEscolar,
      persona: a.persona
        ? {
            id: a.persona.id,
            nombre: a.persona.nombre,
            apellido: a.persona.apellido,
            correo: a.persona.correo,
            telefono: a.persona.telefono,
          }
        : null,
    }));
    return {
      message: 'Alumnos de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${alumnos.length} alumno(s).`,
      total: alumnos.length,
      data: alumnos,
    };
  }

  /**
   * Listar los libros asignados a una escuela (los que la escuela puede ver).
   */
  async listarLibrosDeEscuela(escuelaId: number) {
    const escuela = await this.escuelaRepository.findOne({
      where: { id: escuelaId },
    });
    if (!escuela) {
      throw new NotFoundException(`No se encontró la escuela con ID ${escuelaId}`);
    }

    const asignaciones = await this.escuelaLibroRepository.find({
      where: { escuelaId, activo: true },
      relations: ['libro', 'libro.materia'],
      order: { fechaInicio: 'DESC' },
    });

    const libros = asignaciones.map((a) => ({
      ...a.libro,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      escuelaLibroId: a.id,
    }));

    return {
      message: 'Libros de la escuela obtenidos correctamente.',
      description: `La escuela tiene ${libros.length} libro(s) asignado(s).`,
      total: libros.length,
      data: libros,
    };
  }
}
