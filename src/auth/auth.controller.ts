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

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Iniciar sesión y obtener token JWT
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  /**
   * POST /auth/registro-admin
   * Registrar administrador inicial (máximo 3)
   */
  @Post('registro-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar administrador inicial (máx 3)' })
  @ApiResponse({
    status: 201,
    description: 'Administrador registrado exitosamente',
    schema: {
      example: {
        message: 'Administrador registrado exitosamente',
        description: 'El administrador ha sido creado correctamente. Puede iniciar sesión con su email y contraseña. Total de administradores: 1/3',
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
  @ApiResponse({ status: 409, description: 'Email ya registrado o límite alcanzado' })
  async registrarAdmin(@Body() registroDto: RegistroAdminDto) {
    return await this.authService.registrarAdmin(registroDto);
  }

  /**
   * GET /auth/profile
   * Obtener perfil del usuario autenticado
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@Request() req) {
    return await this.authService.getProfile(req.user.id);
  }
}
