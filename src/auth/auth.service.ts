/**
 * ============================================
 * SERVICIO: AuthService
 * ============================================
 * 
 * Servicio que maneja la autenticación y generación de tokens JWT.
 */

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from '../personas/entities/persona.entity';
import { Administrador } from '../personas/entities/administrador.entity';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';

@Injectable()
export class AuthService {
  private readonly MAX_ADMINS_INICIALES = 3;

  constructor(
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
    @InjectRepository(Administrador)
    private administradorRepository: Repository<Administrador>,
    private jwtService: JwtService,
  ) {}

  /**
   * Validar credenciales y generar token JWT
   */
  async login(loginDto: LoginDto) {
    console.log(`🔐 Intento de login: ${loginDto.email}`);
    
    const persona = await this.personaRepository.findOne({
      where: { correo: loginDto.email },
      relations: ['administrador', 'padre', 'alumno', 'maestro'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'password', 'tipoPersona', 'activo'],
    });

    if (!persona) {
      console.log(`❌ Login fallido: Usuario no encontrado - ${loginDto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, persona.password);
    
    if (!isPasswordValid) {
      console.log(`❌ Login fallido: Contraseña incorrecta - ${loginDto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!persona.activo) {
      console.log(`❌ Login fallido: Usuario inactivo - ${loginDto.email}`);
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Generar token JWT
    const payload = {
      sub: persona.id,
      email: persona.email,
      tipoPersona: persona.tipoPersona,
    };

    const accessToken = this.jwtService.sign(payload);
    
    console.log(`✅ Login exitoso: ${persona.nombre} ${persona.apellidoPaterno} (${persona.tipoPersona}) - ID: ${persona.id}`);

    return {
      message: 'Login exitoso',
      description: 'Usuario autenticado correctamente. Usa el access_token para acceder a endpoints protegidos.',
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: '24h',
      user: {
        id: persona.id,
        nombre: persona.nombre,
        apellido: persona.apellido,
        email: persona.email,
        tipoPersona: persona.tipoPersona,
      },
    };
  }

  /**
   * Registrar un administrador inicial (máximo 3)
   */
  async registrarAdmin(registroDto: RegistroAdminDto) {
    console.log(`📝 Intento de registro de administrador: ${registroDto.email}`);
    
    // Verificar cantidad de administradores
    const cantidadAdmins = await this.administradorRepository.count();
    
    if (cantidadAdmins >= this.MAX_ADMINS_INICIALES) {
      console.log(`❌ Registro fallido: Límite de administradores alcanzado (${cantidadAdmins}/${this.MAX_ADMINS_INICIALES})`);
      throw new ConflictException(
        `Ya se han registrado ${this.MAX_ADMINS_INICIALES} administradores iniciales. Los nuevos administradores deben ser creados por un administrador existente.`,
      );
    }

    // Verificar que el email no esté en uso
    // Solo seleccionar campos que existen en la BD
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
      tipoPersona: 'administrador',
      activo: true,
    });

    const personaGuardada = await this.personaRepository.save(persona);

    // Crear el administrador
    const administrador = this.administradorRepository.create({
      personaId: personaGuardada.id,
      fechaAlta: new Date(),
    });

    await this.administradorRepository.save(administrador);

    console.log(`✅ Administrador creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id} - Email: ${personaGuardada.email}`);
    console.log(`📊 Total de administradores registrados: ${cantidadAdmins + 1}/${this.MAX_ADMINS_INICIALES}`);

    // Retornar la persona sin la contraseña
    const { password, ...result } = personaGuardada;
    return {
      message: 'Administrador registrado exitosamente',
      description: `El administrador ha sido creado correctamente. Puede iniciar sesión con su email y contraseña. Total de administradores: ${cantidadAdmins + 1}/${this.MAX_ADMINS_INICIALES}`,
      data: result,
      administrador: {
        id: administrador.id,
        fechaAlta: administrador.fechaAlta,
      },
    };
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  async getProfile(userId: number) {
    const persona = await this.personaRepository.findOne({
      where: { id: userId },
      relations: ['administrador', 'padre', 'alumno', 'maestro', 'director', 'director.escuela'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'tipoPersona'],
    });

    if (!persona) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      message: 'Perfil obtenido exitosamente',
      description: 'Información del usuario autenticado',
      data: persona,
    };
  }
}
