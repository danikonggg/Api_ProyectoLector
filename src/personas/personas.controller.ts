/**
 * ============================================
 * CONTROLADOR: PersonasController
 * ============================================
 * 
 * Controlador que maneja el registro de usuarios.
 * 
 * Endpoints públicos:
 * - POST /personas/registro-admin - Registrar administrador inicial (máx 3)
 * 
 * Endpoints protegidos (requieren ser admin):
 * - POST /personas/registro-padre - Registrar padre
 * - POST /personas/registro-alumno - Registrar alumno
 * - POST /personas/registro-maestro - Registrar maestro
 * - GET /personas/admins - Listar administradores
 */

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { RegistroPadreDto } from './dto/registro-padre.dto';
import { RegistroAlumnoDto } from './dto/registro-alumno.dto';
import { RegistroMaestroDto } from './dto/registro-maestro.dto';
import { RegistroDirectorDto } from './dto/registro-director.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { Request } from 'express';

@ApiTags('Personas')
@Controller('personas')
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  // Nota: El registro de admin inicial está en /auth/registro-admin

  /**
   * POST /personas/registro-padre
   * Registrar un padre/tutor (solo administradores)
   */
  @Post('registro-padre')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un padre/tutor (requiere admin)' })
  @ApiResponse({
    status: 201,
    description: 'Padre registrado exitosamente',
    schema: {
      example: {
        message: 'Padre registrado exitosamente',
        description: 'El padre/tutor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: {
          idPersona: 1,
          nombre: 'María',
          email: 'padre@example.com',
          tipoPersona: 'padre',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async registrarPadre(@Body() registroDto: RegistroPadreDto) {
    return await this.personasService.registrarPadre(registroDto);
  }

  /**
   * POST /personas/registro-alumno
   * Registrar un alumno (administradores o directores)
   * - Los administradores pueden registrar en cualquier escuela
   * - Los directores solo pueden registrar en su propia escuela
   */
  @Post('registro-alumno')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un alumno (requiere admin o director)' })
  @ApiResponse({
    status: 201,
    description: 'Alumno registrado exitosamente',
    schema: {
      example: {
        message: 'Alumno registrado exitosamente',
        description: 'El alumno ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: {
          idPersona: 1,
          nombre: 'Carlos',
          email: 'alumno@example.com',
          tipoPersona: 'alumno',
          alumno: {
            grado: '5',
            grupo: 'A',
            matricula: '2024001',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador ni director' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async registrarAlumno(@Body() registroDto: RegistroAlumnoDto, @Req() req: Request) {
    const user = req.user as any;
    
    // Si es director, validar que solo pueda registrar en su escuela
    if (user.tipoPersona === 'director' && user.director) {
      if (registroDto.idEscuela !== user.director.escuelaId) {
        throw new ForbiddenException('Los directores solo pueden registrar alumnos en su propia escuela');
      }
    }
    
    return await this.personasService.registrarAlumno(registroDto);
  }

  /**
   * POST /personas/registro-maestro
   * Registrar un maestro/profesor (administradores o directores)
   * - Los administradores pueden registrar en cualquier escuela
   * - Los directores solo pueden registrar en su propia escuela
   */
  @Post('registro-maestro')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un maestro (requiere admin o director)' })
  @ApiResponse({
    status: 201,
    description: 'Maestro registrado exitosamente',
    schema: {
      example: {
        message: 'Maestro registrado exitosamente',
        description: 'El maestro/profesor ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: {
          idPersona: 1,
          nombre: 'Ana',
          email: 'maestro@example.com',
          tipoPersona: 'maestro',
          maestro: {
            especialidad: 'Matemáticas',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador ni director' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async registrarMaestro(@Body() registroDto: RegistroMaestroDto, @Req() req: Request) {
    const user = req.user as any;
    
    // Si es director, validar que solo pueda registrar en su escuela
    if (user.tipoPersona === 'director' && user.director) {
      if (registroDto.idEscuela !== user.director.escuelaId) {
        throw new ForbiddenException('Los directores solo pueden registrar maestros en su propia escuela');
      }
    }
    
    return await this.personasService.registrarMaestro(registroDto);
  }

  /**
   * GET /personas/admins
   * Obtener todos los administradores (solo administradores)
   */
  @Get('admins')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar todos los administradores (requiere admin)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de administradores',
    schema: {
      example: {
        message: 'Administradores obtenidos exitosamente',
        description: 'Se encontraron 3 administrador(es) en el sistema',
        total: 3,
        data: [
          {
            idPersona: 1,
            nombre: 'Admin',
            email: 'admin@example.com',
            tipoPersona: 'administrador',
          },
        ],
      },
    },
  })
  async obtenerAdmins() {
    return await this.personasService.obtenerAdmins();
  }

  /**
   * GET /personas/admins/cantidad
   * Obtener la cantidad de administradores registrados
   */
  @Get('admins/cantidad')
  @ApiOperation({ summary: 'Obtener cantidad de administradores' })
  @ApiResponse({ status: 200, description: 'Cantidad de administradores' })
  async contarAdmins() {
    const cantidad = await this.personasService.contarAdmins();
    return {
      cantidad,
      maxIniciales: 3,
      mensaje: cantidad >= 3 
        ? 'Ya se han registrado los 3 administradores iniciales' 
        : `Puedes registrar ${3 - cantidad} administrador(es) más`,
    };
  }

  /**
   * POST /personas/registro-director
   * Registrar un director/encargado de escuela (solo administradores)
   */
  @Post('registro-director')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un director de escuela (requiere admin)' })
  @ApiResponse({
    status: 201,
    description: 'Director registrado exitosamente',
    schema: {
      example: {
        message: 'Director registrado exitosamente',
        description: 'El director ha sido creado correctamente. Puede iniciar sesión con su email y contraseña.',
        data: {
          idPersona: 1,
          nombre: 'Juan',
          email: 'director@example.com',
          tipoPersona: 'director',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'Email ya registrado o escuela ya tiene director' })
  async registrarDirector(@Body() registroDto: RegistroDirectorDto) {
    return await this.personasService.registrarDirector(registroDto);
  }
}
