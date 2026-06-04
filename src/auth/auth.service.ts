import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
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
import { TokenService } from './services/token.service';
import { BUSINESS_RULES } from '../common/constants/business-rules.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService,
  ) {}

  // ─── Login ────────────────────────────────────────────────────────────────

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

    if (!persona || !(await bcrypt.compare(loginDto.password, persona.password ?? ''))) {
      await this.auditService.log('login_fallido', {
        usuarioId: persona ? Number(persona.id) : null,
        ip: ip ?? null,
        detalles: persona ? 'contraseña_incorrecta' : `usuario_no_encontrado | ${loginDto.email}`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!persona.activo) {
      await this.auditService.log('login_fallido', {
        usuarioId: Number(persona.id),
        ip: ip ?? null,
        detalles: 'usuario_inactivo',
      });
      throw new UnauthorizedException('Usuario inactivo');
    }

    this.assertEscuelaActiva(persona);

    const tokens = await this.tokenService.generateTokenPair(persona, Boolean(loginDto.rememberMe));

    this.logger.log(
      `Login exitoso: ${persona.nombre} ${persona.apellidoPaterno} (${persona.tipoPersona}) ID:${persona.id}`,
    );

    await Promise.all([
      this.auditService.log('login', {
        usuarioId: Number(persona.id),
        ip: ip ?? null,
        detalles: persona.correo,
      }),
      this.prisma.persona.update({
        where: { id: persona.id },
        data: { ultimaConexion: new Date() },
      }),
    ]);

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

  // ─── Refresh ───────────────────────────────────────────────────────────────

  async refreshAccessToken(refreshToken: string, ip?: string) {
    let verified: Awaited<ReturnType<TokenService['verifyAndConsumeRefreshToken']>>;

    try {
      verified = await this.tokenService.verifyAndConsumeRefreshToken(refreshToken);
    } catch (err) {
      await this.auditService.log('refresh_fallido', {
        usuarioId: null,
        ip: ip ?? null,
        detalles: err instanceof Error ? err.message : 'token_refresh_invalido',
      });
      throw err;
    }

    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(verified.storedPersonaId) },
      include: {
        administrador: true,
        padre: true,
        alumno: { include: { escuela: true } },
        maestro: { include: { escuela: true } },
        director: { include: { escuela: true } },
      },
    });

    if (!persona || !persona.activo) {
      throw new UnauthorizedException('Usuario no autorizado para refrescar sesión');
    }

    this.assertEscuelaActiva(persona);

    const tokens = await this.tokenService.generateTokenPair(persona, Boolean(verified.rememberMe));

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

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: number): Promise<{ message: string }> {
    await this.tokenService.revokeAllTokens(userId);
    return { message: 'Sesión cerrada correctamente' };
  }

  // ─── Admin registration ────────────────────────────────────────────────────

  async registrarPrimerAdmin(registroDto: RegistroAdminDto) {
    const cantidadAdmins = await this.prisma.administrador.count();
    if (cantidadAdmins > 0) {
      throw new ConflictException(
        'Ya existe al menos un administrador. Usa el endpoint /auth/registro-admin con autenticación.',
      );
    }
    return this.registrarAdmin(registroDto);
  }

  async registrarAdmin(registroDto: RegistroAdminDto, ip?: string) {
    this.logger.log(`Intento de registro de administrador: ${registroDto.email}`);

    const cantidadAdmins = await this.prisma.administrador.count();

    if (cantidadAdmins >= BUSINESS_RULES.MAX_ADMINS) {
      throw new ConflictException(
        `Ya se han registrado los ${BUSINESS_RULES.MAX_ADMINS} administradores permitidos.`,
      );
    }

    const personaExistente = await this.prisma.persona.findFirst({
      where: { correo: registroDto.email },
      select: { id: true },
    });

    if (personaExistente) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(
      registroDto.password,
      BUSINESS_RULES.BCRYPT_SALT_ROUNDS,
    );

    const personaGuardada = await this.prisma.persona.create({
      data: {
        nombre: registroDto.nombre,
        apellidoPaterno: registroDto.apellidoPaterno,
        apellidoMaterno: registroDto.apellidoMaterno?.trim() || null,
        correo: registroDto.email,
        password: hashedPassword,
        telefono: registroDto.telefono,
        fechaNacimiento: registroDto.fechaNacimiento
          ? new Date(registroDto.fechaNacimiento)
          : null,
        tipoPersona: 'administrador',
        activo: true,
      },
    });

    const administrador = await this.prisma.administrador.create({
      data: { personaId: personaGuardada.id, fechaAlta: new Date() },
    });

    this.logger.log(
      `Administrador creado: ${personaGuardada.nombre} ${personaGuardada.apellidoPaterno} ID:${personaGuardada.id}`,
    );

    await this.auditService.log('registro_admin', {
      usuarioId: Number(personaGuardada.id),
      ip: ip ?? null,
      detalles: personaGuardada.correo,
    });

    const { password: _pw, ...personaSinPassword } = personaGuardada as typeof personaGuardada & {
      password?: string;
    };
    void _pw;

    return {
      message: 'Administrador registrado exitosamente',
      description: `El administrador ha sido creado. Total: ${cantidadAdmins + 1}/${BUSINESS_RULES.MAX_ADMINS}`,
      data: personaSinPassword,
      administrador: { id: Number(administrador.id), fechaAlta: administrador.fechaAlta },
    };
  }

  // ─── Password reset ────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const persona = await this.prisma.persona.findFirst({
      where: { correo: dto.email },
      select: { id: true, nombre: true, correo: true, activo: true },
    });

    const genericResponse = {
      message:
        'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
    };

    if (!persona || !persona.activo) return genericResponse;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + BUSINESS_RULES.RESET_PASSWORD_TTL_MS);

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

    const hashedPassword = await bcrypt.hash(dto.nuevaPassword, BUSINESS_RULES.BCRYPT_SALT_ROUNDS);

    await this.prisma.persona.update({
      where: { id: persona.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshTokenHash: null, // Invalidate all sessions on password reset
      },
    });

    await this.auditService.log('reset_password', {
      usuarioId: Number(persona.id),
      ip: ip ?? null,
      detalles: persona.correo,
    });

    try {
      await this.mailService.sendPasswordChangedEmail(
        persona.correo!,
        persona.nombre ?? 'usuario',
      );
    } catch (err) {
      this.logger.warn(`No se pudo enviar confirmación a ${persona.correo}: ${err}`);
    }

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

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

  // ─── Private helpers ───────────────────────────────────────────────────────

  private assertEscuelaActiva(persona: {
    correo: string | null;
    id: bigint;
    director?: { activo: boolean; escuela?: { estado?: string } } | null;
    maestro?: { activo: boolean; escuela?: { estado?: string } } | null;
    alumno?: { activo: boolean; escuela?: { estado?: string } } | null;
  }): void {
    const ESTADOS_INACTIVOS = ['inactiva', 'suspendida'];
    const msg = 'Tu escuela no está activa. Contacta al administrador.';

    for (const rol of ['director', 'maestro', 'alumno'] as const) {
      const member = persona[rol] as
        | { activo: boolean; escuela?: { estado?: string } }
        | null
        | undefined;
      if (
        member &&
        (!member.activo || ESTADOS_INACTIVOS.includes(member.escuela?.estado ?? ''))
      ) {
        throw new UnauthorizedException(msg);
      }
    }
  }
}
