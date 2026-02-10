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
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { RegistroPadreDto } from './dto/registro-padre.dto';
import { RegistroAlumnoDto } from './dto/registro-alumno.dto';
import { RegistroMaestroDto } from './dto/registro-maestro.dto';
import { RegistroDirectorDto } from './dto/registro-director.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import type { AuditContext } from './personas.service';
import type { Request } from 'express';

function getAuditContext(req: Request): AuditContext {
  const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
  return {
    usuarioId: (req.user as any)?.id ?? null,
    ip: typeof ip === 'string' ? ip : undefined,
  };
}

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
  @ApiTags('Solo Administrador')
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
  async registrarPadre(@Body() registroDto: RegistroPadreDto, @Req() req: Request) {
    return await this.personasService.registrarPadre(registroDto, getAuditContext(req));
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
  @ApiTags('Admin o Director')
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

    if (user.tipoPersona === 'director' && user.director) {
      const miEscuelaId = Number(user.director.escuelaId ?? user.director.escuela?.id);
      // Director: si no envía idEscuela, se usa su escuela
      if (registroDto.idEscuela == null || registroDto.idEscuela === undefined) {
        registroDto.idEscuela = miEscuelaId;
      } else if (Number(registroDto.idEscuela) !== miEscuelaId) {
        throw new ForbiddenException('Los directores solo pueden registrar alumnos en su propia escuela');
      }
    } else {
      // Admin: idEscuela es obligatorio
      if (registroDto.idEscuela == null || registroDto.idEscuela === undefined) {
        throw new BadRequestException('Debe indicar el ID de la escuela (idEscuela)');
      }
    }

    return await this.personasService.registrarAlumno(registroDto, getAuditContext(req));
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
  @ApiTags('Admin o Director')
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

    if (user.tipoPersona === 'director' && user.director) {
      const miEscuelaId = Number(user.director.escuelaId ?? user.director.escuela?.id);
      // Director: si no envía idEscuela, se usa su escuela automáticamente
      if (registroDto.idEscuela == null || registroDto.idEscuela === undefined) {
        registroDto.idEscuela = miEscuelaId;
      } else if (Number(registroDto.idEscuela) !== miEscuelaId) {
        throw new ForbiddenException('Los directores solo pueden registrar maestros en su propia escuela');
      }
    } else {
      // Admin: idEscuela es obligatorio
      if (registroDto.idEscuela == null || registroDto.idEscuela === undefined) {
        throw new BadRequestException('Debe indicar el ID de la escuela (idEscuela)');
      }
    }

    return await this.personasService.registrarMaestro(registroDto, getAuditContext(req));
  }

  /**
   * GET /personas/admins
   * Obtener todos los administradores (solo administradores)
   */
  @Get('admins')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Solo Administrador')
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
   * Obtener la cantidad de administradores registrados (solo admin)
   */
  @Get('admins/cantidad')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Obtener cantidad de administradores (requiere admin)' })
  @ApiResponse({ status: 200, description: 'Cantidad de administradores' })
  async contarAdmins() {
    const cantidad = await this.personasService.contarAdmins();
    const MAX_ADMINS = 5;
    return {
      cantidad,
      maxAdmins: MAX_ADMINS,
      mensaje: cantidad >= MAX_ADMINS
        ? `Ya se han registrado los ${MAX_ADMINS} administradores permitidos`
        : `Puedes registrar ${MAX_ADMINS - cantidad} administrador(es) más`,
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
  @ApiTags('Solo Administrador')
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
  @ApiResponse({ status: 409, description: 'Email ya registrado o escuela ya tiene 3 directores' })
  async registrarDirector(@Body() registroDto: RegistroDirectorDto, @Req() req: Request) {
    return await this.personasService.registrarDirector(registroDto, getAuditContext(req));
  }

  // ========== GET Alumnos y Padres (requieren token) ==========

  /**
   * GET /personas/alumnos
   * Listar alumnos. Admin: todos. Director: solo de su escuela.
   * Incluye persona, escuela y padre (si tiene) para ver de quién es hijo.
   */
  @Get('alumnos')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Listar alumnos (admin: todos, director: solo su escuela)' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos con padre (si tiene)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async obtenerAlumnos(
    @Req() req: Request,
    @Query('escuelaId') escuelaId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as any;
    let escuelaIdFiltro: number | undefined;
    if (user.tipoPersona === 'director' && user.director) {
      escuelaIdFiltro = Number(user.director.escuelaId ?? user.director.escuela?.id);
    } else if (escuelaId) {
      escuelaIdFiltro = parseInt(escuelaId, 10);
    }
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return await this.personasService.obtenerAlumnos(escuelaIdFiltro, pageNum, limitNum);
  }

  /**
   * GET /personas/alumnos/buscar
   * Búsqueda global por un campo. Solo query campo y valor. Sin paginación ni filtro por escuela.
   * Admin: todos los alumnos que coincidan. Director: solo los de su escuela.
   */
  @Get('alumnos/buscar')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({
    summary: 'Buscar alumnos por un campo (búsqueda global)',
    description:
      'Solo se envían campo y valor. Devuelve todos los resultados (sin paginación). Admin: global. Director: solo su escuela.',
  })
  @ApiResponse({ status: 200, description: 'Lista de alumnos que coinciden' })
  @ApiResponse({ status: 400, description: 'Campo no permitido o valor vacío' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async buscarAlumnos(
    @Query('campo') campo: string,
    @Query('valor') valor: string,
    @Req() req: Request,
  ) {
    if (!campo || !valor) {
      throw new BadRequestException('Se requieren los query params "campo" y "valor".');
    }
    const user = req.user as any;
    let escuelaIdFiltro: number | undefined;
    if (user.tipoPersona === 'director' && user.director) {
      escuelaIdFiltro = Number(user.director.escuelaId ?? user.director.escuela?.id);
    }
    return await this.personasService.buscarAlumnos(campo, valor, escuelaIdFiltro);
  }

  /**
   * GET /personas/alumnos/:id/padre
   * Obtener el padre/tutor de un alumno (si tiene)
   * Ruta más específica debe ir antes que alumnos/:id
   */
  @Get('alumnos/:id/padre')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Ver de quién es hijo un alumno (padre/tutor)' })
  @ApiResponse({ status: 200, description: 'Padre del alumno o null si no tiene' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado' })
  async obtenerPadreDeAlumno(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    return await this.personasService.obtenerPadreDeAlumno(id, escuelaId);
  }

  /**
   * GET /personas/alumnos/:id
   * Obtener alumno por ID con su padre
   */
  @Get('alumnos/:id')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Obtener alumno por ID (con padre si tiene)' })
  @ApiResponse({ status: 200, description: 'Alumno encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado' })
  async obtenerAlumnoPorId(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    return await this.personasService.obtenerAlumnoPorId(id, escuelaId);
  }

  /**
   * GET /personas/padres
   * Listar todos los padres/tutores del sistema
   */
  @Get('padres')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar todos los padres/tutores' })
  @ApiResponse({ status: 200, description: 'Lista de padres con sus alumnos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async obtenerPadres(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return await this.personasService.obtenerPadres(pageNum, limitNum);
  }

  /**
   * GET /personas/padres/:id/alumnos
   * Obtener los alumnos (hijos) de un padre
   * Ruta más específica debe ir antes que padres/:id
   */
  @Get('padres/:id/alumnos')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Ver los hijos/alumnos de un padre' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos del padre' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  @ApiResponse({ status: 404, description: 'Padre no encontrado' })
  async obtenerAlumnosDePadre(@Param('id', ParseIntPipe) id: number) {
    return await this.personasService.obtenerAlumnosDePadre(id);
  }

  /**
   * GET /personas/padres/:id
   * Obtener padre por ID con sus alumnos (de quién es padre)
   */
  @Get('padres/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Obtener padre por ID con sus hijos/alumnos' })
  @ApiResponse({ status: 200, description: 'Padre encontrado con sus alumnos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  @ApiResponse({ status: 404, description: 'Padre no encontrado' })
  async obtenerPadrePorId(@Param('id', ParseIntPipe) id: number) {
    return await this.personasService.obtenerPadrePorId(id);
  }
}
