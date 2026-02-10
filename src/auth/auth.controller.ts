/**
 * ============================================
 * CONTROLADOR: AuthController
 * ============================================
 * 
 * Controlador que maneja la autenticación:
 * - Login (genera JWT token)
 * - Registro de administrador inicial
 * - Obtener perfil del usuario autenticado
 */

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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroAdminDto } from './dto/registro-admin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Iniciar sesión y obtener token JWT
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Público')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso, retorna token JWT',
    schema: {
      example: {
        message: 'Login exitoso',
        description: 'Usuario autenticado correctamente. Usa el access_token para acceder a endpoints protegidos.',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
        expires_in: '24h',
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
  async login(@Body() loginDto: LoginDto, @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
    const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
    return await this.authService.login(loginDto, typeof ip === 'string' ? ip : undefined);
  }

  /**
   * POST /auth/registro-admin
   * Registrar nuevo administrador (máximo 5). Solo administradores pueden crear otros admins.
   */
  @Post('registro-admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  async registrarAdmin(@Body() registroDto: RegistroAdminDto, @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
    const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
    return await this.authService.registrarAdmin(registroDto, typeof ip === 'string' ? ip : undefined);
  }

  /**
   * GET /auth/profile
   * Obtener perfil del usuario autenticado
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Cualquier autenticado')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@Request() req) {
    return await this.authService.getProfile(req.user.id);
  }
}
