import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_ADMINS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto, ip?: string) {
    this.logger.log(`Intento de login: ${loginDto.email}`);

    const persona = await this.prisma.persona.findFirst({
      where: { correo: loginDto.email },
      include: {
        administrador: true,
        padre: true,
        alumno: { include: { escuela: true } },
        maestro: { include: { escuela: true } },
        director: { include: { escuela: true } },
      },
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

    const isPasswordValid = await bcrypt.compare(loginDto.password, persona.password ?? '');

    if (!isPasswordValid) {
      this.logger.warn(`Login fallido: Contraseña incorrecta - ${loginDto.email}`);
      await this.auditService.log('login_fallido', {
        usuarioId: Number(persona.id),
        ip: ip ?? null,
        detalles: `contraseña_incorrecta | ${persona.correo}`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!persona.activo) {
      this.logger.warn(`Login fallido: Usuario inactivo - ${loginDto.email}`);
      await this.auditService.log('login_fallido', {
        usuarioId: Number(persona.id),
        ip: ip ?? null,
        detalles: `usuario_inactivo | ${persona.correo}`,
      });
      throw new UnauthorizedException('Usuario inactivo');
    }

    const escuelaInactivaMsg = 'Tu escuela no está activa. Contacta al administrador.';
    if (persona.director) {
      const d = persona.director as typeof persona.director & { escuela?: { estado?: string } };
      if (!d.activo || (d as any).escuela?.estado === 'inactiva' || (d as any).escuela?.estado === 'suspendida') {
        await this.auditService.log('login_fallido', { usuarioId: Number(persona.id), ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.maestro) {
      const m = persona.maestro as any;
      if (!m.activo || m.escuela?.estado === 'inactiva' || m.escuela?.estado === 'suspendida') {
        await this.auditService.log('login_fallido', { usuarioId: Number(persona.id), ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.alumno) {
      const a = persona.alumno as any;
      if (!a.activo || a.escuela?.estado === 'inactiva' || a.escuela?.estado === 'suspendida') {
        await this.auditService.log('login_fallido', { usuarioId: Number(persona.id), ip: ip ?? null, detalles: `escuela_inactiva | ${persona.correo}` });
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }

    const payload = {
      sub: Number(persona.id),
      email: persona.correo,
      tipoPersona: persona.tipoPersona,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(
      `Login exitoso: ${persona.nombre} ${persona.apellidoPaterno} (${persona.tipoPersona}) - ID: ${persona.id}`,
    );

    await this.auditService.log('login', {
      usuarioId: Number(persona.id),
      ip: ip ?? null,
      detalles: persona.correo,
    });

    await this.prisma.persona.update({
      where: { id: persona.id },
      data: { ultimaConexion: new Date() },
    });

    return {
      message: 'Login exitoso',
      description:
        'Usuario autenticado correctamente. Usa el access_token para acceder a endpoints protegidos.',
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: '24h',
      user: {
        id: Number(persona.id),
        nombre: persona.nombre,
        apellidoPaterno: persona.apellidoPaterno,
        apellidoMaterno: persona.apellidoMaterno ?? null,
        email: persona.correo,
        tipoPersona: persona.tipoPersona,
      },
    };
  }

  async registrarPrimerAdmin(registroDto: RegistroAdminDto) {
    const cantidadAdmins = await this.prisma.administrador.count();
    if (cantidadAdmins > 0) {
      throw new ConflictException(
        'Ya existe al menos un administrador. Usa el endpoint /auth/registro-admin con autenticación.',
      );
    }
    return await this.registrarAdmin(registroDto);
  }

  async registrarAdmin(registroDto: RegistroAdminDto, ip?: string) {
    this.logger.log(`Intento de registro de administrador: ${registroDto.email}`);

    const cantidadAdmins = await this.prisma.administrador.count();

    if (cantidadAdmins >= this.MAX_ADMINS) {
      throw new ConflictException(
        `Ya se han registrado los ${this.MAX_ADMINS} administradores permitidos.`,
      );
    }

    const personaExistente = await this.prisma.persona.findFirst({
      where: { correo: registroDto.email },
      select: { id: true },
    });

    if (personaExistente) {
      this.logger.warn(`Registro fallido: Email ya registrado - ${registroDto.email}`);
      throw new ConflictException('El email ya está registrado');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registroDto.password, saltRounds);

    const personaGuardada = await this.prisma.persona.create({
      data: {
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento ? new Date(registroDto.fechaNacimiento) : null,
        tipoPersona: 'administrador',
        activo: true,
      },
    });

    const administrador = await this.prisma.administrador.create({
      data: {
        personaId: personaGuardada.id,
        fechaAlta: new Date(),
      },
    });

    this.logger.log(
      `Administrador creado exitosamente: ${personaGuardada.nombre} ${personaGuardada.apellidoPaterno} - ID: ${personaGuardada.id}`,
    );

    await this.auditService.log('registro_admin', {
      usuarioId: Number(personaGuardada.id),
      ip: ip ?? null,
      detalles: personaGuardada.correo,
    });

    const result = { ...personaGuardada } as Record<string, unknown>;
    delete result.password;
    return {
      message: 'Administrador registrado exitosamente',
      description: `El administrador ha sido creado correctamente. Total de administradores: ${cantidadAdmins + 1}/${this.MAX_ADMINS}`,
      data: result,
      administrador: {
        id: Number(administrador.id),
        fechaAlta: administrador.fechaAlta,
      },
    };
  }

  async getProfile(userId: number) {
    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        correo: true,
        telefono: true,
        fechaNacimiento: true,
        genero: true,
        tipoPersona: true,
        ultimaConexion: true,
        administrador: true,
        padre: true,
        alumno: true,
        maestro: true,
        director: { include: { escuela: true } },
      },
    });

    if (!persona) throw new UnauthorizedException('Usuario no encontrado');

    return {
      message: 'Perfil obtenido exitosamente',
      description: 'Información del usuario autenticado',
      data: persona,
    };
  }
}
