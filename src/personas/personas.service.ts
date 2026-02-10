/**
 * ============================================
 * SERVICIO: PersonasService
 * ============================================
 * 
 * Servicio que maneja el registro de usuarios con diferentes roles.
 * - Permite registrar hasta 3 administradores iniciales (sin autenticación)
 * - Los demás usuarios solo pueden ser creados por administradores
 */

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from './entities/persona.entity';
import { Administrador } from './entities/administrador.entity';
import { Padre } from './entities/padre.entity';
import { Alumno } from './entities/alumno.entity';
import { Maestro } from './entities/maestro.entity';
import { Director } from './entities/director.entity';
import { Escuela } from './entities/escuela.entity';
import { RegistroPadreDto } from './dto/registro-padre.dto';
import { RegistroAlumnoDto } from './dto/registro-alumno.dto';
import { RegistroMaestroDto } from './dto/registro-maestro.dto';
import { RegistroDirectorDto } from './dto/registro-director.dto';
import { AuditService } from '../audit/audit.service';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

@Injectable()
export class PersonasService {
  private readonly logger = new Logger(PersonasService.name);
  private readonly MAX_ADMINS_INICIALES = 3;

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Administrador)
    private readonly administradorRepository: Repository<Administrador>,
    @InjectRepository(Padre)
    private readonly padreRepository: Repository<Padre>,
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(Maestro)
    private readonly maestroRepository: Repository<Maestro>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
    @InjectRepository(Escuela)
    private readonly escuelaRepository: Repository<Escuela>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  // Nota: El registro de admin está en AuthService

  /**
   * Registrar un padre (solo por administrador)
   * Usa transacción para garantizar atomicidad: persona + padre + vinculación alumno.
   */
  async registrarPadre(registroDto: RegistroPadreDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de padre: ${registroDto.email}`);

    return await this.dataSource.transaction(async (manager) => {
      const personaRepo = manager.getRepository(Persona);
      const padreRepo = manager.getRepository(Padre);
      const alumnoRepo = manager.getRepository(Alumno);

      const personaExistente = await personaRepo.findOne({
        where: { correo: registroDto.email },
        select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });

      if (personaExistente) {
        this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
        throw new ConflictException('El email ya está registrado');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

      const persona = personaRepo.create({
        nombre: registroDto.nombre,
        apellido: registroDto.apellidoPaterno,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento
          ? new Date(registroDto.fechaNacimiento)
          : null,
        tipoPersona: 'padre',
        activo: true,
      });

      const personaGuardada = await personaRepo.save(persona);

      const padre = padreRepo.create({
        personaId: personaGuardada.id,
      });

      const padreGuardado = await padreRepo.save(padre);

      if (registroDto.alumnoId != null) {
        const alumno = await alumnoRepo.findOne({ where: { id: registroDto.alumnoId } });
        if (alumno) {
          alumno.padreId = padreGuardado.id;
          await alumnoRepo.save(alumno);
          this.logger.log(`Alumno ID ${alumno.id} vinculado al padre ID ${padreGuardado.id}`);
        }
      }

      this.logger.log(`Padre creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id}`);

      await this.auditService.log('registro_padre', {
        usuarioId: auditContext?.usuarioId ?? null,
        ip: auditContext?.ip ?? null,
        detalles: personaGuardada.correo,
      });

      const resultado = await personaRepo.findOne({
        where: { id: personaGuardada.id },
        relations: ['padre'],
        select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
      });

      const { password, ...resultadoSinPassword } = resultado;

      return {
        message: 'Padre registrado exitosamente',
        description: 'El padre/tutor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: resultadoSinPassword,
      };
    });
  }

  /**
   * Registrar un alumno
   */
  async registrarAlumno(registroDto: RegistroAlumnoDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de alumno: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

    // Crear la persona
    const persona = this.personaRepository.create({
      nombre: registroDto.nombre,
      apellido: registroDto.apellidoPaterno,
      correo: registroDto.email,
      password: hashedPassword,
      telefono: registroDto.telefono,
      fechaNacimiento: registroDto.fechaNacimiento
        ? new Date(registroDto.fechaNacimiento)
        : null,
      tipoPersona: 'alumno',
      activo: true,
    });

    const personaGuardada = await this.personaRepository.save(persona);

    // Verificar que la escuela existe
    const escuela = await this.escuelaRepository.findOne({
      where: { id: registroDto.idEscuela },
    });

    if (!escuela) {
      this.logger.warn(`Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
      throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
    }

    // Crear el alumno (sin padre)
    const alumno = this.alumnoRepository.create({
      personaId: personaGuardada.id,
      escuelaId: registroDto.idEscuela,
      grado: registroDto.grado ? parseInt(registroDto.grado.toString()) : 1,
      grupo: registroDto.grupo,
      cicloEscolar: registroDto.cicloEscolar || null,
      padreId: null,
    });

    await this.alumnoRepository.save(alumno);

    this.logger.log(`Alumno creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Grado: ${alumno.grado}`);

    await this.auditService.log('registro_alumno', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    const resultado = await this.personaRepository.findOne({
      where: { id: personaGuardada.id },
      relations: ['alumno', 'alumno.escuela'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    const { password, ...resultadoSinPassword } = resultado;

    return {
      message: 'Alumno registrado exitosamente',
      description: 'El alumno ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultadoSinPassword,
    };
  }

  /**
   * Registrar un maestro (solo por administrador)
   */
  async registrarMaestro(registroDto: RegistroMaestroDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de maestro: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

    // Crear la persona
    const persona = this.personaRepository.create({
      nombre: registroDto.nombre,
      apellido: registroDto.apellidoPaterno,
      correo: registroDto.email,
      password: hashedPassword,
      telefono: registroDto.telefono,
      fechaNacimiento: registroDto.fechaNacimiento
        ? new Date(registroDto.fechaNacimiento)
        : null,
      tipoPersona: 'maestro',
      activo: true,
    });

    const personaGuardada = await this.personaRepository.save(persona);

    // Verificar que la escuela existe
    const escuela = await this.escuelaRepository.findOne({
      where: { id: registroDto.idEscuela },
    });

    if (!escuela) {
      this.logger.warn(`Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
      throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
    }

    // Crear el maestro
    const maestro = this.maestroRepository.create({
      personaId: personaGuardada.id,
      escuelaId: registroDto.idEscuela,
      especialidad: registroDto.especialidad,
      fechaContratacion: registroDto.fechaIngreso
        ? new Date(registroDto.fechaIngreso)
        : null,
    });

    await this.maestroRepository.save(maestro);

    this.logger.log(`Maestro creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Especialidad: ${maestro.especialidad || 'N/A'}`);

    await this.auditService.log('registro_maestro', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    // Retornar la persona con el maestro
    const resultado = await this.personaRepository.findOne({
      where: { id: personaGuardada.id },
      relations: ['maestro', 'maestro.escuela'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    const { password, ...resultadoSinPassword } = resultado;
    
    return {
      message: 'Maestro registrado exitosamente',
      description: 'El maestro/profesor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultadoSinPassword,
    };
  }

  /**
   * Obtener todos los administradores
   */
  async obtenerAdmins() {
    // Buscar personas que tienen relación con Administrador
    const admins = await this.personaRepository
      .createQueryBuilder('persona')
      .leftJoinAndSelect('persona.administrador', 'administrador')
      .where('administrador.id IS NOT NULL')
      .select([
        'persona.id',
        'persona.nombre',
        'persona.apellido',
        'persona.correo',
        'persona.telefono',
        'persona.fechaNacimiento',
        'persona.genero',
        'administrador.id',
        'administrador.personaId',
        'administrador.fechaAlta',
      ])
      .getMany();

    this.logger.log(`Consulta de administradores: ${admins.length} encontrados`);

    return {
      message: 'Administradores obtenidos exitosamente',
      description: `Se encontraron ${admins.length} administrador(es) en el sistema`,
      total: admins.length,
      data: admins,
    };
  }

  /**
   * Registrar un director (solo por administrador)
   */
  async registrarDirector(registroDto: RegistroDirectorDto, auditContext?: AuditContext) {
    this.logger.log(`Intento de registro de director: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar que la escuela existe
    const escuela = await this.escuelaRepository.findOne({
      where: { id: registroDto.idEscuela },
    });

    if (!escuela) {
      this.logger.warn(`Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
      throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
    }

    // Verificar que la escuela no tenga ya 3 directores (máximo por escuela)
    const MAX_DIRECTORES_POR_ESCUELA = 3;
    const cantidadDirectores = await this.directorRepository.count({
      where: { escuelaId: registroDto.idEscuela },
    });

    if (cantidadDirectores >= MAX_DIRECTORES_POR_ESCUELA) {
      this.logger.warn(`Registro fallido: La escuela ya tiene ${MAX_DIRECTORES_POR_ESCUELA} directores asignados`);
      throw new ConflictException(`Esta escuela ya tiene el máximo de ${MAX_DIRECTORES_POR_ESCUELA} directores asignados`);
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

    // Crear la persona
    const persona = this.personaRepository.create({
      nombre: registroDto.nombre,
      apellido: registroDto.apellidoPaterno,
      correo: registroDto.email,
      password: hashedPassword,
      telefono: registroDto.telefono,
      fechaNacimiento: registroDto.fechaNacimiento
        ? new Date(registroDto.fechaNacimiento)
        : null,
      tipoPersona: 'director',
      activo: true,
    });

    const personaGuardada = await this.personaRepository.save(persona);

    // Crear el director
    const director = this.directorRepository.create({
      personaId: personaGuardada.id,
      escuelaId: registroDto.idEscuela,
      fechaNombramiento: registroDto.fechaNombramiento
        ? new Date(registroDto.fechaNombramiento)
        : new Date(),
    });

    await this.directorRepository.save(director);

    this.logger.log(`Director creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Escuela ID: ${registroDto.idEscuela}`);

    await this.auditService.log('registro_director', {
      usuarioId: auditContext?.usuarioId ?? null,
      ip: auditContext?.ip ?? null,
      detalles: `${personaGuardada.correo} | escuelaId: ${registroDto.idEscuela}`,
    });

    // Retornar la persona con el director
    const resultado = await this.personaRepository.findOne({
      where: { id: personaGuardada.id },
      relations: ['director', 'director.escuela'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    const { password, ...resultadoSinPassword } = resultado;
    
    return {
      message: 'Director registrado exitosamente',
      description: 'El director ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
      data: resultadoSinPassword,
    };
  }

  /**
   * Obtener cantidad de administradores registrados
   */
  async contarAdmins(): Promise<number> {
    return await this.administradorRepository.count();
  }

  /**
   * Obtener todos los alumnos (Admin: todos; Director: solo de su escuela)
   * @param escuelaIdFiltro - Filtrar por escuela
   * @param page - Página (1-based). Si no se pasa, devuelve todos.
   * @param limit - Límite por página (default 50). Si no se pasa con page, devuelve todos.
   */
  async obtenerAlumnos(escuelaIdFiltro?: number, page?: number, limit?: number) {
    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null) {
      qb.andWhere('alumno.escuelaId = :escuelaId', {
        escuelaId: escuelaIdFiltro,
      });
    }

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const alumnos = await qb.getMany();
    const data = alumnos.map((a) => this.formatearAlumnoConPadre(a));

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Alumnos obtenidos exitosamente',
      description: `Se encontraron ${data.length} alumno(s)`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /** Campos permitidos para buscar alumnos (evita inyección) */
  private static readonly CAMPOS_BUSCAR_ALUMNO = [
    'nombre',
    'apellido',
    'correo',
    'telefono',
    'grado',
    'grupo',
    'cicloEscolar',
    'escuelaId',
  ] as const;

  /**
   * Buscar alumnos por un solo campo. Búsqueda global: sin paginación.
   * Admin: todos los que coincidan. Director: solo los de su escuela (escuelaIdFiltro).
   * @param campo - nombre, apellido, correo, telefono, grado, grupo, cicloEscolar, escuelaId
   * @param valor - valor a buscar (texto con LIKE %valor% o número exacto según el campo)
   */
  async buscarAlumnos(campo: string, valor: string, escuelaIdFiltro?: number) {
    const campoNormalizado = campo.trim().toLowerCase();
    if (!PersonasService.CAMPOS_BUSCAR_ALUMNO.includes(campoNormalizado as any)) {
      throw new BadRequestException(
        `Campo de búsqueda no permitido. Use uno de: ${PersonasService.CAMPOS_BUSCAR_ALUMNO.join(', ')}`,
      );
    }
    if (valor == null || String(valor).trim() === '') {
      throw new BadRequestException('El valor de búsqueda no puede estar vacío.');
    }

    const qb = this.alumnoRepository
      .createQueryBuilder('alumno')
      .leftJoinAndSelect('alumno.persona', 'persona')
      .leftJoinAndSelect('alumno.escuela', 'escuela')
      .leftJoinAndSelect('alumno.padre', 'padre')
      .leftJoinAndSelect('padre.persona', 'padrePersona')
      .orderBy('alumno.id', 'ASC');

    if (escuelaIdFiltro != null) {
      qb.andWhere('alumno.escuelaId = :escuelaId', { escuelaId: escuelaIdFiltro });
    }

    const valorTrim = String(valor).trim();
    const camposTextoPersona = ['nombre', 'apellido', 'correo', 'telefono'];
    const camposTextoAlumno = ['grupo', 'cicloEscolar'];
    const camposNumero = ['grado', 'escuelaId'];

    if (camposTextoPersona.includes(campoNormalizado)) {
      qb.andWhere(`persona.${campoNormalizado} LIKE :valorBuscar`, {
        valorBuscar: `%${valorTrim}%`,
      });
    } else if (camposTextoAlumno.includes(campoNormalizado)) {
      qb.andWhere(`alumno.${campoNormalizado} LIKE :valorBuscar`, {
        valorBuscar: `%${valorTrim}%`,
      });
    } else if (camposNumero.includes(campoNormalizado)) {
      const num = parseInt(valorTrim, 10);
      if (Number.isNaN(num)) {
        throw new BadRequestException(`El campo "${campo}" requiere un número.`);
      }
      qb.andWhere(`alumno.${campoNormalizado} = :valorNum`, { valorNum: num });
    }

    const alumnos = await qb.getMany();
    const data = alumnos.map((a) => this.formatearAlumnoConPadre(a));

    return {
      message: 'Búsqueda de alumnos realizada',
      description: `Se encontraron ${data.length} alumno(s) con ${campo}=${valorTrim}`,
      total: data.length,
      data,
    };
  }

  /**
   * Obtener un alumno por ID con su padre
   * @param escuelaIdRestriccion - Si se pasa, solo se devuelve si el alumno pertenece a esa escuela (para directores)
   */
  async obtenerAlumnoPorId(id: number, escuelaIdRestriccion?: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id },
      relations: ['persona', 'escuela', 'padre', 'padre.persona'],
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${id}`);
    }
    if (escuelaIdRestriccion != null && alumno.escuelaId !== escuelaIdRestriccion) {
      throw new NotFoundException(`No se encontró el alumno con ID ${id}`);
    }
    return {
      message: 'Alumno obtenido exitosamente',
      description: 'Alumno encontrado en el sistema',
      data: this.formatearAlumnoConPadre(alumno),
    };
  }

  /**
   * Obtener el padre de un alumno (si tiene)
   * @param escuelaIdRestriccion - Si se pasa, solo se devuelve si el alumno pertenece a esa escuela (para directores)
   */
  async obtenerPadreDeAlumno(alumnoId: number, escuelaIdRestriccion?: number) {
    const alumno = await this.alumnoRepository.findOne({
      where: { id: alumnoId },
      relations: ['padre', 'padre.persona', 'persona'],
    });
    if (!alumno) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    }
    if (escuelaIdRestriccion != null && alumno.escuelaId !== escuelaIdRestriccion) {
      throw new NotFoundException(`No se encontró el alumno con ID ${alumnoId}`);
    }
    if (!alumno.padre) {
      return {
        message: 'Alumno sin padre asignado',
        description: 'Este alumno no tiene un padre/tutor registrado en el sistema',
        data: null,
      };
    }
    return {
      message: 'Padre del alumno obtenido exitosamente',
      description: `Padre/tutor de ${alumno.persona?.nombre ?? 'el alumno'}`,
      data: {
        id: alumno.padre.id,
        parentesco: alumno.padre.parentesco,
        persona: alumno.padre.persona
          ? {
              id: alumno.padre.persona.id,
              nombre: alumno.padre.persona.nombre,
              apellido: alumno.padre.persona.apellido,
              correo: alumno.padre.persona.correo,
              telefono: alumno.padre.persona.telefono,
            }
          : null,
      },
    };
  }

  /**
   * Obtener todos los padres
   * @param page - Página (1-based). Si no se pasa, devuelve todos.
   * @param limit - Límite por página (default 50). Si no se pasa con page, devuelve todos.
   */
  async obtenerPadres(page?: number, limit?: number) {
    const qb = this.padreRepository
      .createQueryBuilder('padre')
      .leftJoinAndSelect('padre.persona', 'persona')
      .leftJoinAndSelect('padre.alumnos', 'alumnos')
      .leftJoinAndSelect('alumnos.persona', 'alumnosPersona')
      .leftJoinAndSelect('alumnos.escuela', 'alumnosEscuela')
      .orderBy('padre.id', 'ASC');

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const padres = await qb.getMany();
    const data = padres.map((p) => this.formatearPadreConAlumnos(p));

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Padres obtenidos exitosamente',
      description: `Se encontraron ${data.length} padre(s)/tutor(es) en el sistema`,
      total,
      ...(meta && { meta }),
      data,
    };
  }

  /**
   * Obtener un padre por ID con sus alumnos
   */
  async obtenerPadrePorId(id: number) {
    const padre = await this.padreRepository.findOne({
      where: { id },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) {
      throw new NotFoundException(`No se encontró el padre con ID ${id}`);
    }
    return {
      message: 'Padre obtenido exitosamente',
      description: 'Padre/tutor encontrado en el sistema',
      data: this.formatearPadreConAlumnos(padre),
    };
  }

  /**
   * Obtener los alumnos (hijos) de un padre
   */
  async obtenerAlumnosDePadre(padreId: number) {
    const padre = await this.padreRepository.findOne({
      where: { id: padreId },
      relations: ['persona', 'alumnos', 'alumnos.persona', 'alumnos.escuela'],
    });
    if (!padre) {
      throw new NotFoundException(`No se encontró el padre con ID ${padreId}`);
    }
    const alumnos = (padre.alumnos || []).map((a) => this.formatearAlumnoParaLista(a));
    return {
      message: 'Alumnos del padre obtenidos exitosamente',
      description: `${padre.persona?.nombre ?? 'Este padre'} tiene ${alumnos.length} hijo(s) registrado(s)`,
      total: alumnos.length,
      data: alumnos,
    };
  }

  private formatearAlumnoConPadre(alumno: any) {
    return {
      id: alumno.id,
      personaId: alumno.personaId,
      escuelaId: alumno.escuelaId,
      padreId: alumno.padreId ?? null,
      grado: alumno.grado,
      grupo: alumno.grupo,
      cicloEscolar: alumno.cicloEscolar,
      persona: alumno.persona
        ? {
            id: alumno.persona.id,
            nombre: alumno.persona.nombre,
            apellido: alumno.persona.apellido,
            correo: alumno.persona.correo,
            telefono: alumno.persona.telefono,
          }
        : null,
      escuela: alumno.escuela
        ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre, nivel: alumno.escuela.nivel }
        : null,
      padre: alumno.padre
        ? {
            id: alumno.padre.id,
            parentesco: alumno.padre.parentesco,
            persona: alumno.padre.persona
              ? {
                  id: alumno.padre.persona.id,
                  nombre: alumno.padre.persona.nombre,
                  apellido: alumno.padre.persona.apellido,
                  correo: alumno.padre.persona.correo,
                  telefono: alumno.padre.persona.telefono,
                }
              : null,
          }
        : null,
    };
  }

  private formatearAlumnoParaLista(alumno: any) {
    return {
      id: alumno.id,
      personaId: alumno.personaId,
      escuelaId: alumno.escuelaId,
      grado: alumno.grado,
      grupo: alumno.grupo,
      cicloEscolar: alumno.cicloEscolar,
      persona: alumno.persona
        ? {
            id: alumno.persona.id,
            nombre: alumno.persona.nombre,
            apellido: alumno.persona.apellido,
            correo: alumno.persona.correo,
            telefono: alumno.persona.telefono,
          }
        : null,
      escuela: alumno.escuela
        ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre }
        : null,
    };
  }

  private formatearPadreConAlumnos(padre: any) {
    const correo = padre.persona?.correo || '';
    const pendiente = correo.includes('@temp.local');
    return {
      id: padre.id,
      personaId: padre.personaId,
      parentesco: padre.parentesco,
      pendiente,
      persona: padre.persona
        ? {
            id: padre.persona.id,
            nombre: padre.persona.nombre,
            apellido: padre.persona.apellido,
            correo: padre.persona.correo,
            telefono: padre.persona.telefono,
          }
        : null,
      cantidadHijos: (padre.alumnos || []).length,
      alumnos: (padre.alumnos || []).map((a) => this.formatearAlumnoParaLista(a)),
    };
  }
}
