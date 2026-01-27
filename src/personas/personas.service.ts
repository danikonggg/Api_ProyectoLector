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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class PersonasService {
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
  ) {}

  // Nota: El registro de admin está en AuthService

  /**
   * Registrar un padre (solo por administrador)
   */
  async registrarPadre(registroDto: RegistroPadreDto) {
    console.log(`📝 Intento de registro de padre: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      console.log(`❌ Registro fallido: Email ya registrado - ${registroDto.email}`);
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
      tipoPersona: 'padre',
      activo: true,
    });

    const personaGuardada = await this.personaRepository.save(persona);

    // Crear el padre
    const padre = this.padreRepository.create({
      personaId: personaGuardada.id,
    });

    await this.padreRepository.save(padre);

    console.log(`✅ Padre creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Email: ${personaGuardada.email}`);

    // Retornar la persona con el padre
    const resultado = await this.personaRepository.findOne({
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
  }

  /**
   * Registrar un alumno (solo por administrador)
   */
  async registrarAlumno(registroDto: RegistroAlumnoDto) {
    console.log(`📝 Intento de registro de alumno: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      console.log(`❌ Registro fallido: Email ya registrado - ${registroDto.email}`);
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
      console.log(`❌ Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
      throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
    }

    // Crear el alumno
    const alumno = this.alumnoRepository.create({
      personaId: personaGuardada.id,
      escuelaId: registroDto.idEscuela,
      grado: registroDto.grado ? parseInt(registroDto.grado.toString()) : 1,
      grupo: registroDto.grupo,
      cicloEscolar: registroDto.cicloEscolar || null,
    });

    await this.alumnoRepository.save(alumno);

    console.log(`✅ Alumno creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Email: ${personaGuardada.email} - Grado: ${alumno.grado}`);

    // Retornar la persona con el alumno
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
  async registrarMaestro(registroDto: RegistroMaestroDto) {
    console.log(`📝 Intento de registro de maestro: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      console.log(`❌ Registro fallido: Email ya registrado - ${registroDto.email}`);
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
      console.log(`❌ Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
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

    console.log(`✅ Maestro creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Email: ${personaGuardada.email} - Especialidad: ${maestro.especialidad || 'N/A'}`);

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
    
    console.log(`📋 Consulta de administradores: ${admins.length} encontrados`);
    
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
  async registrarDirector(registroDto: RegistroDirectorDto) {
    console.log(`📝 Intento de registro de director: ${registroDto.email}`);
    
    // Verificar que el email no esté en uso
    const personaExistente = await this.personaRepository.findOne({
      where: { correo: registroDto.email },
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero'],
    });

    if (personaExistente) {
      console.log(`❌ Registro fallido: Email ya registrado - ${registroDto.email}`);
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar que la escuela existe
    const escuela = await this.escuelaRepository.findOne({
      where: { id: registroDto.idEscuela },
    });

    if (!escuela) {
      console.log(`❌ Registro fallido: Escuela no encontrada - ID: ${registroDto.idEscuela}`);
      throw new NotFoundException(`No se encontró la escuela con ID ${registroDto.idEscuela}`);
    }

    // Verificar que la escuela no tenga ya un director
    const directorExistente = await this.directorRepository.findOne({
      where: { escuelaId: registroDto.idEscuela },
    });

    if (directorExistente) {
      console.log(`❌ Registro fallido: La escuela ya tiene un director asignado`);
      throw new ConflictException('Esta escuela ya tiene un director asignado');
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

    console.log(`✅ Director creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Email: ${personaGuardada.email} - Escuela ID: ${registroDto.idEscuela}`);

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
}
