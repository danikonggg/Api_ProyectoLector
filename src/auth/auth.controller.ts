import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminGuard } from './guards/admin.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Iniciar sesión y obtener token JWT.
   * Límite estricto por IP para evitar fuerza bruta (5 intentos por minuto).
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiTags('Público')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso, retorna token JWT',
    schema: {
      example: {
        message: 'Login exitoso',
        description:
          'Usuario autenticado correctamente. Usa access_token para endpoints protegidos y refresh_token para renovar sesión.',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
        expires_in: '2d',
        refresh_expires_in: '50d',
        remember_me: true,
        user: {
          idPersona: 1,
          nombre: 'Juan',
          email: 'admin@example.com',
          tipoPersona: 'administrador',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const ip =
      req.ip ??
      (Array.isArray(req.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers?.['x-forwarded-for']) ??
      req.headers?.['x-real-ip'];
    return await this.authService.login(loginDto, typeof ip === 'string' ? ip : undefined);
  }

  /**
   * POST /auth/refresh
   * Renueva la sesión con refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiTags('Público')
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados correctamente',
    schema: {
      example: {
        message: 'Token renovado exitosamente',
        description: 'Sesión renovada. Se emite nuevo access_token y refresh_token.',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
        expires_in: '2d',
        refresh_expires_in: '50d',
        remember_me: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const ip =
      req.ip ??
      (Array.isArray(req.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers?.['x-forwarded-for']) ??
      req.headers?.['x-real-ip'];

    return await this.authService.refreshAccessToken(
      refreshTokenDto.refresh_token,
      typeof ip === 'string' ? ip : undefined,
    );
  }

  /**
   * POST /auth/primer-admin
   * Registrar administrador sin autenticación — solo funciona si no hay ninguno registrado aún.
   */
  @Public()
  @Post('primer-admin')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiTags('Público')
  @ApiOperation({
    summary: 'Registrar primer administrador (sin auth, solo si no existe ninguno)',
    description:
      'Endpoint de arranque inicial. Solo funciona cuando no hay administradores registrados. Máximo 3 admins en total.',
  })
  @ApiResponse({ status: 201, description: 'Administrador registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe al menos un administrador registrado' })
  async primerAdmin(@Body() registroDto: RegistroAdminDto) {
    return await this.authService.registrarPrimerAdmin(registroDto);
  }

  /**
   * POST /auth/registro-admin
   * Registrar nuevo administrador (máximo 3). Solo administradores pueden crear otros admins.
   */
  @Post('registro-admin')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Registrar administrador (máx 5, requiere admin)' })
  @ApiResponse({
    status: 201,
    description: 'Administrador registrado exitosamente',
    schema: {
      example: {
        message: 'Administrador registrado exitosamente',
        description: 'El administrador ha sido creado correctamente. Total de administradores: 4/5',
        data: {
          idPersona: 1,
          nombre: 'Juan',
          email: 'admin@example.com',
          tipoPersona: 'administrador',
        },
        administrador: {
          idAdmin: 1,
          nivel: 'normal',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  @ApiResponse({ status: 409, description: 'Email ya registrado o límite alcanzado' })
  async registrarAdmin(
    @Body() registroDto: RegistroAdminDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const ip =
      req.ip ??
      (Array.isArray(req.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers?.['x-forwarded-for']) ??
      req.headers?.['x-real-ip'];
    return await this.authService.registrarAdmin(
      registroDto,
      typeof ip === 'string' ? ip : undefined,
    );
  }

  /**
   * POST /auth/forgot-password
   * Solicitar enlace de recuperación de contraseña vía correo.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiTags('Público')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Si el correo existe, se enviará un enlace de recuperación',
    schema: {
      example: {
        message: 'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
      },
    },
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const ip =
      req.ip ??
      (Array.isArray(req.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers?.['x-forwarded-for']) ??
      req.headers?.['x-real-ip'];
    return await this.authService.forgotPassword(dto, typeof ip === 'string' ? ip : undefined);
  }

  /**
   * POST /auth/reset-password
   * Restablecer contraseña usando el token recibido por correo.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiTags('Público')
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, description: 'Contraseña restablecida exitosamente' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const ip =
      req.ip ??
      (Array.isArray(req.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers?.['x-forwarded-for']) ??
      req.headers?.['x-real-ip'];
    return await this.authService.resetPassword(dto, typeof ip === 'string' ? ip : undefined);
  }

  /**
   * GET /auth/profile
   * Obtener perfil del usuario autenticado
   */
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Cualquier autenticado')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@Request() req) {
    return await this.authService.getProfile(req.user.id);
  }
}
