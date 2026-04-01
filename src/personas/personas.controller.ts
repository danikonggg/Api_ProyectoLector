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
  Patch,
  Delete,
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
import { RegistroPadreConHijoDto } from './dto/registro-padre-con-hijo.dto';
import { RegistroDirectorDto } from './dto/registro-director.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { VincularAlumnoDto } from './dto/vincular-alumno.dto';
import { DesvincularAlumnoDto } from './dto/desvincular-alumno.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { getAuditContext } from '../common/utils/audit.utils';
import { User } from '../auth/decorators/user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import type { Request } from 'express';

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
   * POST /personas/registro-padre-con-hijo
   * Registrar un padre/tutor y un alumno (hijo) a la vez.
   * Solo administradores.
   */
  @Post('registro-padre-con-hijo')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Registrar un padre/tutor y un alumno (requiere admin)' })
  @ApiResponse({ status: 201, description: 'Padre e hijo registrados exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async registrarPadreConHijo(
    @Body() registroDto: RegistroPadreConHijoDto,
    @Req() req: Request,
  ) {
    return await this.personasService.registrarPadreConHijo(registroDto, getAuditContext(req));
  }

  /**
   * POST /personas/padres/vincular-alumno
   * Vincular un alumno a la cuenta de un padre/tutor mediante un código único.
   * Debe ser llamado por un usuario cuyo tipoPersona sea "padre".
   */
  @Post('padres/vincular-alumno')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Padre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vincular un alumno a un padre mediante un código de un solo uso' })
  @ApiResponse({ status: 200, description: 'Alumno vinculado correctamente' })
  @ApiResponse({ status: 400, description: 'Código inválido, ya utilizado o expirado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async vincularAlumnoComoPadre(
    @Body() dto: VincularAlumnoDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    if (user.tipoPersona !== 'padre' || !user.padre) {
      throw new ForbiddenException('Solo los padres/tutores pueden vincular alumnos con un código');
    }
    return await this.personasService.vincularAlumnoConPadrePorCodigo(user.padre.id, dto.codigo);
  }

  /**
   * POST /personas/padres/desvincular-alumno
   * Desvincular un alumno de la cuenta del padre/tutor autenticado.
   * Solo el tutor puede desvincular alumnos que tenga vinculados.
   */
  @Post('padres/desvincular-alumno')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Padre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desvincular un alumno del tutor' })
  @ApiResponse({ status: 200, description: 'Alumno desvinculado correctamente' })
  @ApiResponse({ status: 403, description: 'El alumno no está vinculado a tu cuenta' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async desvincularAlumnoComoPadre(
    @Body() dto: DesvincularAlumnoDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    if (user.tipoPersona !== 'padre' || !user.padre) {
      throw new ForbiddenException('Solo los padres/tutores pueden desvincular alumnos');
    }
    return await this.personasService.desvincularAlumnoDelPadre(user.padre.id, dto.alumnoId);
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
    const user = req.user as RequestUser;

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
    const user = req.user as RequestUser;

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
    const user = req.user as RequestUser;
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
    const user = req.user as RequestUser;
    let escuelaIdFiltro: number | undefined;
    if (user.tipoPersona === 'director' && user.director) {
      escuelaIdFiltro = Number(user.director.escuelaId ?? user.director.escuela?.id);
    }
    return await this.personasService.buscarAlumnos(campo, valor, escuelaIdFiltro);
  }

  /**
   * GET /personas/alumnos/codigo-vinculacion
   * Compatibilidad con Frontend: devuelve el código del alumno autenticado.
   */
  @Get('alumnos/codigo-vinculacion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Alumno')
  @ApiOperation({ summary: 'Obtener el código de vinculación del alumno (propio, sin id en URL)' })
  @ApiResponse({ status: 200, description: 'Código de vinculación obtenido correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async obtenerMiCodigoVinculacionAlumno(
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    // El frontend puede consumir este endpoint como Alumno o como Padre/Tutor.
    if (user.alumno) {
      return await this.personasService.obtenerCodigoVinculacionAlumno(Number(user.alumno.id));
    }
    if (user.padre) {
      return await this.personasService.obtenerCodigoVinculacionParaPadre(Number(user.padre.id));
    }
    throw new ForbiddenException('Solo alumnos o padres/tutores pueden acceder a esta ruta');
  }

  /**
   * GET /personas/alumnos/:id/codigo-vinculacion
   * Obtener el código de vinculación del alumno (solo para su propio código).
   *
   * Importante:
   * - Esta ruta NO usa AdminOrDirectorGuard para que el rol Alumno pueda consultarla.
   * - Valida que el :id corresponda al alumno autenticado (por alumno.id o por alumno.personaId, para compatibilidad).
   */
  @Get('alumnos/:id/codigo-vinculacion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Alumno')
  @ApiOperation({ summary: 'Obtener el código de vinculación del alumno (propio)' })
  @ApiResponse({ status: 200, description: 'Código de vinculación obtenido correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async obtenerCodigoVinculacionAlumno(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    // Preferimos basarnos en la relación "alumno" para evitar inconsistencias en tipoPersona.
    if (!user.alumno) {
      throw new ForbiddenException('Solo los alumnos pueden acceder a esta ruta');
    }

    // Para compatibilidad: el frontend puede enviar id de alumno o id de persona.
    const alumnoId = Number(user.alumno.id);
    const personaId = Number((user.alumno as any).personaId ?? user.alumno.persona?.id);
    if (alumnoId !== Number(id) && personaId !== Number(id)) {
      throw new ForbiddenException('No puedes consultar el código de otro alumno');
    }

    return await this.personasService.obtenerCodigoVinculacionAlumno(id);
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
    const user = req.user as RequestUser;
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
    const user = req.user as RequestUser;

    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    return await this.personasService.obtenerAlumnoPorId(id, escuelaId);
  }

  /**
   * PATCH /personas/alumnos/:id
   * Actualizar un alumno (admin: cualquier escuela; director: solo de su escuela).
   * El :id es el ID del registro alumno (no el de persona).
   */
  @Patch('alumnos/:id')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({
    summary: 'Actualizar alumno (admin o director; director solo de su escuela)',
    description: 'Actualiza datos de persona (nombre, correo, etc.) y opcionalmente grupoId para asignar o quitar del grupo.',
  })
  @ApiResponse({ status: 200, description: 'Alumno actualizado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado' })
  async actualizarAlumno(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    return await this.personasService.actualizarAlumno(id, dto, escuelaId, getAuditContext(req));
  }

  /**
   * DELETE /personas/alumnos/:id
   * Eliminar un alumno (admin: cualquier escuela; director: solo de su escuela).
   * El :id es el ID del registro alumno (no el de persona).
   */
  @Delete('alumnos/:id')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Eliminar alumno (admin o director; director solo de su escuela)' })
  @ApiResponse({ status: 200, description: 'Alumno eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado' })
  async eliminarAlumno(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    const { data } = await this.personasService.obtenerAlumnoPorId(id, escuelaId);
    return await this.personasService.eliminarUsuarioPorId(data.personaId, getAuditContext(req));
  }

  /**
   * PATCH /personas/maestros/:id
   * Actualizar un maestro (admin: cualquier escuela; director: solo de su escuela).
   * El :id es el ID del registro maestro (no el de persona).
   */
  @Patch('maestros/:id')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Actualizar maestro (admin o director; director solo de su escuela)' })
  @ApiResponse({ status: 200, description: 'Maestro actualizado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Maestro no encontrado' })
  async actualizarMaestro(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    const { data } = await this.personasService.obtenerMaestroPorId(id, escuelaId);
    return await this.personasService.actualizarUsuarioPorId(data.personaId, dto, getAuditContext(req));
  }

  /**
   * DELETE /personas/maestros/:id
   * Eliminar un maestro (admin: cualquier escuela; director: solo de su escuela).
   * El :id es el ID del registro maestro (no el de persona).
   */
  @Delete('maestros/:id')
  @UseGuards(JwtAuthGuard, AdminOrDirectorGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Eliminar maestro (admin o director; director solo de su escuela)' })
  @ApiResponse({ status: 200, description: 'Maestro eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Maestro no encontrado' })
  async eliminarMaestro(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    const escuelaId = user.tipoPersona === 'director' && user.director
      ? Number(user.director.escuelaId ?? user.director.escuela?.id)
      : undefined;
    const { data } = await this.personasService.obtenerMaestroPorId(id, escuelaId);
    return await this.personasService.eliminarUsuarioPorId(data.personaId, getAuditContext(req));
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Padre o Administrador')
  @ApiOperation({ summary: 'Ver los hijos/alumnos de un padre (propio o admin)' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos del padre' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (solo admin o tu propio padre)' })
  @ApiResponse({ status: 404, description: 'Padre no encontrado' })
  async obtenerAlumnosDePadre(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    if (user.tipoPersona === 'padre' && user.padre) {
      // El Frontend podría mandar el id incorrecto (padre.id vs personaId).
      // Para seguridad, siempre resolvemos contra el padre del token.
      return await this.personasService.obtenerAlumnosDePadre(Number(user.padre.id));
    } else if (user.tipoPersona === 'administrador' && user.administrador) {
      // Admin: puede ver cualquier padre
    } else {
      throw new ForbiddenException('Solo administradores o padres/tutores pueden acceder a esta ruta');
    }

    return await this.personasService.obtenerAlumnosDePadre(id);
  }

  /**
   * GET /personas/padres/:id
   * Obtener padre por ID con sus alumnos (de quién es padre)
   */
  @Get('padres/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Padre o Administrador')
  @ApiOperation({ summary: 'Obtener padre por ID con sus hijos/alumnos (propio o admin)' })
  @ApiResponse({ status: 200, description: 'Padre encontrado con sus alumnos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (solo admin o tu propio padre)' })
  @ApiResponse({ status: 404, description: 'Padre no encontrado' })
  async obtenerPadrePorId(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    if (user.tipoPersona === 'padre' && user.padre) {
      // Para seguridad, siempre resolvemos el padre del token.
      return await this.personasService.obtenerPadrePorId(Number(user.padre.id));
    } else if (user.tipoPersona === 'administrador' && user.administrador) {
      // Admin: puede ver cualquier padre
    } else {
      throw new ForbiddenException('Solo administradores o padres/tutores pueden acceder a esta ruta');
    }

    return await this.personasService.obtenerPadrePorId(id);
  }
}
