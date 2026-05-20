import { Injectable, UnauthorizedException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_ADMINS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  private getAccessTokenTtl(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '2d');
  }

  private getRefreshTokenTtlLong(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '50d');
  }

  private getRefreshTokenTtlShort(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN_SHORT', '2d');
  }

  private getRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET')?.trim() ||
      this.configService.getOrThrow<string>('JWT_SECRET');
  }

  private buildTokenPayload(persona: {
    id: bigint;
    correo: string | null;
    tipoPersona: string | null;
  }) {
    return {
      sub: Number(persona.id),
      email: persona.correo ?? undefined,
      tipoPersona: persona.tipoPersona ?? undefined,
    };
  }

  private generateTokenPair(persona: {
    id: bigint;
    correo: string | null;
    tipoPersona: string | null;
  }, rememberMe = false) {
    const payload = this.buildTokenPayload(persona);
    const refreshExpiresIn = rememberMe
      ? this.getRefreshTokenTtlLong()
      : this.getRefreshTokenTtlShort();

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.getAccessTokenTtl(),
    });

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        tokenType: 'refresh',
        rememberMe,
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: refreshExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.getAccessTokenTtl(),
      refreshExpiresIn,
      rememberMe,
    };
  }

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

    const tokens = this.generateTokenPair(persona, Boolean(loginDto.rememberMe));

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
        'Usuario autenticado correctamente. Usa access_token para endpoints protegidos y refresh_token para renovar sesión.',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.accessExpiresIn,
      refresh_expires_in: tokens.refreshExpiresIn,
      remember_me: tokens.rememberMe,
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

  async refreshAccessToken(refreshToken: string, ip?: string) {
    type RefreshPayload = {
      sub: number;
      email?: string;
      tipoPersona?: string;
      tokenType?: string;
      rememberMe?: boolean;
    };

    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      await this.auditService.log('refresh_fallido', {
        usuarioId: null,
        ip: ip ?? null,
        detalles: 'token_refresh_invalido',
      });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.tokenType !== 'refresh' || payload.sub == null) {
      await this.auditService.log('refresh_fallido', {
        usuarioId: payload?.sub ?? null,
        ip: ip ?? null,
        detalles: 'tipo_token_invalido',
      });
      throw new UnauthorizedException('Refresh token inválido');
    }

    const persona = await this.prisma.persona.findFirst({
      where: { id: BigInt(payload.sub) },
      include: {
        administrador: true,
        padre: true,
        alumno: { include: { escuela: true } },
        maestro: { include: { escuela: true } },
        director: { include: { escuela: true } },
      },
    });

    if (!persona || !persona.activo) {
      await this.auditService.log('refresh_fallido', {
        usuarioId: payload.sub,
        ip: ip ?? null,
        detalles: 'usuario_invalido_o_inactivo',
      });
      throw new UnauthorizedException('Usuario no autorizado para refrescar sesión');
    }

    const escuelaInactivaMsg = 'Tu escuela no está activa. Contacta al administrador.';
    if (persona.director) {
      const d = persona.director as typeof persona.director & { escuela?: { estado?: string } };
      if (
        !d.activo ||
        (d as any).escuela?.estado === 'inactiva' ||
        (d as any).escuela?.estado === 'suspendida'
      ) {
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.maestro) {
      const m = persona.maestro as any;
      if (!m.activo || m.escuela?.estado === 'inactiva' || m.escuela?.estado === 'suspendida') {
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }
    if (persona.alumno) {
      const a = persona.alumno as any;
      if (!a.activo || a.escuela?.estado === 'inactiva' || a.escuela?.estado === 'suspendida') {
        throw new UnauthorizedException(escuelaInactivaMsg);
      }
    }

    const tokens = this.generateTokenPair(persona, Boolean(payload.rememberMe));

    await this.auditService.log('refresh_ok', {
      usuarioId: Number(persona.id),
      ip: ip ?? null,
      detalles: persona.correo,
    });

    return {
      message: 'Token renovado exitosamente',
      description: 'Sesión renovada. Se emite nuevo access_token y refresh_token.',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.accessExpiresIn,
      refresh_expires_in: tokens.refreshExpiresIn,
      remember_me: tokens.rememberMe,
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

  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const persona = await this.prisma.persona.findFirst({
      where: { correo: dto.email },
      select: { id: true, nombre: true, correo: true, activo: true },
    });

    // Respuesta genérica para no revelar si el correo existe o no
    const genericResponse = {
      message: 'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
    };

    if (!persona || !persona.activo) return genericResponse;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.persona.update({
      where: { id: persona.id },
      data: { resetPasswordToken: token, resetPasswordExpires: expires },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordResetEmail(persona.correo!, persona.nombre, resetUrl);

    await this.auditService.log('forgot_password', {
      usuarioId: Number(persona.id),
      ip: ip ?? null,
      detalles: persona.correo,
    });

    this.logger.log(`Solicitud de recuperación de contraseña: ${dto.email}`);
    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    const persona = await this.prisma.persona.findFirst({
      where: { resetPasswordToken: dto.token },
      select: { id: true, correo: true, nombre: true, resetPasswordExpires: true },
    });

    if (!persona) {
      throw new BadRequestException('El token es inválido o ya fue utilizado.');
    }

    if (!persona.resetPasswordExpires || persona.resetPasswordExpires < new Date()) {
      throw new BadRequestException('El token ha expirado. Solicita uno nuevo.');
    }

    const hashedPassword = await bcrypt.hash(dto.nuevaPassword, 10);

    await this.prisma.persona.update({
      where: { id: persona.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    await this.auditService.log('reset_password', {
      usuarioId: Number(persona.id),
      ip: ip ?? null,
      detalles: persona.correo,
    });

    // Enviar confirmación — si falla el correo no rompemos el flujo
    try {
      await this.mailService.sendPasswordChangedEmail(persona.correo!, persona.nombre ?? 'usuario');
    } catch (err) {
      this.logger.warn(`No se pudo enviar el correo de confirmación a ${persona.correo}: ${err}`);
    }

    this.logger.log(`Contraseña restablecida exitosamente para: ${persona.correo}`);
    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
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
