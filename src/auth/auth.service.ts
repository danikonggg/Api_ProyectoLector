import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Persona } from '../personas/entities/persona.entity';
import { Administrador } from '../personas/entities/administrador.entity';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_ADMINS = 5;

  constructor(
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
    @InjectRepository(Administrador)
    private administradorRepository: Repository<Administrador>,
    private jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validar credenciales y generar token JWT
   */
  async login(loginDto: LoginDto, ip?: string) {
    this.logger.log(`Intento de login: ${loginDto.email}`);
    
    const persona = await this.personaRepository.findOne({
      where: { correo: loginDto.email },
      relations: ['administrador', 'padre', 'alumno', 'alumno.escuela', 'maestro', 'maestro.escuela', 'director', 'director.escuela'],
      select: ['id', 'nombre', 'apellido', 'correo', 'telefono', 'fechaNacimiento', 'genero', 'password', 'tipoPersona', 'activo'],
    });

    if (!persona) {
      this.logger.warn(`Login fallido: Usuario no encontrado - ${loginDto.email}`);
      await this.auditService.log('login_fallido', {
        usuarioId: null,
        ip: ip ?? null,
        detalles: `usuario_no_encontrado | ${loginDto.email}`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, persona.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login fallido: Contraseña incorrecta - ${loginDto.email}`);
      await this.auditService.log('login_fallido', {
        usuarioId: persona.id,
        ip: ip ?? null,
        detalles: `contraseña_incorrecta | ${persona.correo}`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!persona.activo) {
      this.logger.warn(`Login fallido: Usuario inactivo - ${loginDto.email}`);
      await this.auditService.log('login_fallido', {
        usuarioId: persona.id,
        ip: ip ?? null,
        detalles: `usuario_inactivo | ${persona.correo}`,
      });
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Si es director, maestro o alumno: verificar que esté activo y que la escuela esté activa
    const escuelaInactivaMsg = 'Tu escuela no está activa. Contacta al administrador.';
    if (persona.director) {
      const d = persona.director;
      if (!d.activo || d.escuela?.estado === 'inactiva' || d.escuela?.estado === 'suspendida') {
        this.logger.warn(`Login fallido: Director de escuela inactiva - ${loginDto.email}`);
        await this.auditService.log('login_fallido', { usuarioId: persona.id, ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.maestro) {
      const m = persona.maestro;
      if (!m.activo || m.escuela?.estado === 'inactiva' || m.escuela?.estado === 'suspendida') {
        this.logger.warn(`Login fallido: Maestro de escuela inactiva - ${loginDto.email}`);
        await this.auditService.log('login_fallido', { usuarioId: persona.id, ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.alumno) {
      const a = persona.alumno;
      if (!a.activo || a.escuela?.estado === 'inactiva' || a.escuela?.estado === 'suspendida') {
        this.logger.warn(`Login fallido: Alumno de escuela inactiva - ${loginDto.email}`);
        await this.auditService.log('login_fallido', { usuarioId: persona.id, ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }

    // Generar token JWT
    const payload = {
      sub: persona.id,
      email: persona.correo,
      tipoPersona: persona.tipoPersona,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Login exitoso: ${persona.nombre} ${persona.apellido} (${persona.tipoPersona}) - ID: ${persona.id}`);

    await this.auditService.log('login', {
      usuarioId: persona.id,
      ip: ip ?? null,
      detalles: persona.correo,
    });

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
        email: persona.correo,
        tipoPersona: persona.tipoPersona,
      },
    };
  }

  /**
   * Registrar un administrador (máximo 5). Requiere ser admin autenticado.
   */
  async registrarAdmin(registroDto: RegistroAdminDto, ip?: string) {
    this.logger.log(`Intento de registro de administrador: ${registroDto.email}`);
    
    // Verificar cantidad de administradores
    const cantidadAdmins = await this.administradorRepository.count();
    
    if (cantidadAdmins >= this.MAX_ADMINS) {
      this.logger.warn(`Registro fallido: Límite de administradores alcanzado (${cantidadAdmins}/${this.MAX_ADMINS})`);
      throw new ConflictException(
        `Ya se han registrado los ${this.MAX_ADMINS} administradores permitidos.`,
      );
    }

    // Verificar que el email no esté en uso
    // Solo seleccionar campos que existen en la BD
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

    this.logger.log(`Administrador creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellido} - ID: ${personaGuardada.id}`);
    this.logger.log(`Total de administradores registrados: ${cantidadAdmins + 1}/${this.MAX_ADMINS}`);

    await this.auditService.log('registro_admin', {
      usuarioId: personaGuardada.id,
      ip: ip ?? null,
      detalles: personaGuardada.correo,
    });

    // Retornar la persona sin la contraseña
    const { password, ...result } = personaGuardada;
    return {
      message: 'Administrador registrado exitosamente',
      description: `El administrador ha sido creado correctamente. Puede iniciar sesión con su email y contraseña. Total de administradores: ${cantidadAdmins + 1}/${this.MAX_ADMINS}`,
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
