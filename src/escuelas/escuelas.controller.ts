/**
 * ============================================
 * CONTROLADOR: EscuelasController
 * ============================================
 * 
 * Controlador que maneja las operaciones CRUD de escuelas.
 * 
 * Todos los endpoints requieren autenticación y ser administrador:
 * - POST /escuelas - Crear escuela
 * - GET /escuelas - Listar todas las escuelas
 * - GET /escuelas/:id - Obtener escuela por ID
 * - PUT /escuelas/:id - Actualizar escuela
 * - DELETE /escuelas/:id - Eliminar escuela
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { EscuelasService } from './escuelas.service';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { AsignarLibroEscuelaDto } from './dto/asignar-libro-escuela.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import type { AuditContext } from './escuelas.service';
import type { Request as ExpressRequest } from 'express';

function getAuditContext(req: ExpressRequest): AuditContext {
  const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
  return {
    usuarioId: (req.user as any)?.id ?? null,
    ip: typeof ip === 'string' ? ip : undefined,
  };
}

type ReqUser = {
  tipoPersona?: string;
  director?: { escuelaId: number };
  alumno?: { escuelaId: number };
};

function directorSoloSuEscuela(user: ReqUser | undefined, escuelaId: number): void {
  if (user?.tipoPersona === 'director' && user?.director) {
    const miEscuelaId = user.director.escuelaId;
    if (Number(miEscuelaId) !== Number(escuelaId)) {
      throw new ForbiddenException('Solo puedes ver los datos de tu escuela.');
    }
  }
}

@Controller('escuelas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class EscuelasController {
  constructor(private readonly escuelasService: EscuelasService) {}

  /**
   * POST /escuelas
   * Crear una nueva escuela (solo administradores)
   */
  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Crear una nueva escuela (requiere admin)' })
  @ApiResponse({
    status: 201,
    description: 'Escuela creada exitosamente',
    schema: {
      example: {
        message: 'Escuela creada exitosamente',
        description: 'La escuela ha sido registrada correctamente en el sistema.',
        data: {
          id: 1,
          nombre: 'Escuela Primaria Benito Juárez',
          nivel: 'Primaria',
          clave: '29DPR0123X',
          direccion: 'Calle Principal #123',
          telefono: '5551234567',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'Escuela con nombre o clave duplicada' })
  async crear(@Body() crearEscuelaDto: CrearEscuelaDto, @Request() req: ExpressRequest) {
    return await this.escuelasService.crear(crearEscuelaDto, getAuditContext(req));
  }

  /**
   * GET /escuelas
   * Obtener todas las escuelas (solo administradores). Listado simple.
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar todas las escuelas (requiere admin)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de escuelas',
    schema: {
      example: {
        message: 'Escuelas obtenidas exitosamente',
        total: 5,
        data: [
          { id: 1, nombre: 'Escuela Primaria Benito Juárez', nivel: 'Primaria', clave: '29DPR0123X', direccion: 'Calle Principal #123', telefono: '5551234567' },
        ],
      },
    },
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  async obtenerTodas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return await this.escuelasService.obtenerTodas(pageNum, limitNum);
  }

  /**
   * GET /escuelas/stats
   * Estadísticas del panel de gestión de escuelas (tarjetas: total escuelas, activas, alumnos, profesores, licencias).
   */
  @Get('stats')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Estadísticas del panel de escuelas (requiere admin)' })
  @ApiResponse({
    status: 200,
    description: 'Totales para las tarjetas del dashboard de escuelas',
    schema: {
      example: {
        message: 'Estadísticas del panel de escuelas obtenidas correctamente',
        data: {
          totalEscuelas: 5,
          escuelasActivas: 4,
          totalAlumnos: 1840,
          totalProfesores: 134,
          licencias: 2000,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  async obtenerEstadisticasPanel() {
    return await this.escuelasService.obtenerEstadisticasPanel();
  }

  /**
   * GET /escuelas/directores
   * Listar todos los directores del sistema con su escuela (solo administradores).
   */
  @Get('directores')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar todos los directores de las escuelas (requiere admin)' })
  @ApiResponse({ status: 200, description: 'Lista de directores con datos de persona y escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  async listarTodosDirectores(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return await this.escuelasService.listarTodosLosDirectores(pageNum, limitNum);
  }

  /**
   * GET /escuelas/con-libros
   * Listar todas las escuelas con los libros que tiene cada una (admin). Un mismo libro puede estar en varias escuelas.
   */
  @Get('con-libros')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Ver libros que tiene cada escuela (admin)',
    description: 'Devuelve todas las escuelas y, por cada una, la lista de libros asignados. El mismo libro puede aparecer en varias escuelas.',
  })
  @ApiResponse({ status: 200, description: 'Lista de escuelas con su array de libros.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  async listarEscuelasConLibros() {
    return await this.escuelasService.listarEscuelasConLibros();
  }

  /**
   * GET /escuelas/mis-libros
   * Libros de la escuela del alumno autenticado.
   */
  @Get('mis-libros')
  @UseGuards(AlumnoGuard)
  @ApiTags('Solo Alumno')
  @ApiOperation({ summary: 'Libros de mi escuela (solo alumnos)' })
  @ApiResponse({ status: 200, description: 'Libros asignados a la escuela del alumno.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo alumnos.' })
  async misLibros(@Request() req: { user?: ReqUser }) {
    const escuelaId = req.user?.alumno?.escuelaId;
    if (!escuelaId) {
      throw new ForbiddenException('No se encontró la escuela del alumno.');
    }
    return await this.escuelasService.listarLibrosDeEscuela(escuelaId);
  }

  /**
   * GET /escuelas/:id/libros/pendientes
   * Libros otorgados por admin, pendientes de canjear por la escuela.
   */
  @Get(':id/libros/pendientes')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Libros pendientes de canjear (solo admin)',
    description: 'Requiere id de escuela en la URL. **Directores:** usar GET /director/libros/pendientes (tag Director, sin id).',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Libros pendientes de canjear.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  async listarLibrosPendientes(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.escuelasService.listarLibrosPendientesDeEscuela(id, false);
  }

  /**
   * POST /escuelas/:id/libros/canjear
   * La escuela (director) canjea el código. Solo si el admin ya otorgó ese libro.
   */
  @Post(':id/libros/canjear')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Canjear libro (Paso 2) — solo admin',
    description: 'Requiere id de escuela en la URL. **Directores:** usar POST /director/canjear-libro (tag Director, sin id en la ruta).',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['codigo'],
      properties: { codigo: { type: 'string', example: 'LIB-1735123456-abc12345' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Libro canjeado correctamente.' })
  @ApiResponse({ status: 400, description: 'El admin no otorgó este libro a la escuela.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  async canjearLibro(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarLibroEscuelaDto,
    @Request() req: ExpressRequest,
  ) {
    return await this.escuelasService.canjearLibroPorCodigo(id, dto.codigo, getAuditContext(req));
  }

  /**
   * GET /escuelas/:id/libros/asignaciones
   * Listar todas las asignaciones libro-escuela (activas e inactivas) para asignar/desasignar desde el front.
   */
  @Get(':id/libros/asignaciones')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Ver libros de la escuela para asignar/desasignar (admin)',
    description: 'Devuelve todos los libros asignados a la escuela con activoEnEscuela y activoGlobal. Usar con PATCH .../libros/:libroId/activo para activar o quitar.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Lista de asignaciones con activoEnEscuela y datos del libro.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarAsignacionesLibros(@Param('id', ParseIntPipe) id: number) {
    return await this.escuelasService.listarAsignacionesLibrosDeEscuela(id);
  }

  /**
   * GET /escuelas/:id/libros
   * Listar libros activos de la escuela (solo los ya canjeados y activos).
   */
  @Get(':id/libros')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Listar libros activos de la escuela (solo admin)',
    description: 'Requiere id de escuela en la URL. **Directores:** usar GET /director/libros (tag Director, sin id).',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Libros activos de la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarLibros(@Param('id', ParseIntPipe) id: number) {
    return await this.escuelasService.listarLibrosDeEscuela(id);
  }

  /**
   * PATCH /escuelas/:id/libros/:libroId/activo
   * Activar o desactivar un libro solo para esta escuela.
   */
  @Patch(':id/libros/:libroId/activo')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Activar/desactivar libro en esta escuela. Requiere admin.' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiParam({ name: 'libroId', type: 'number', description: 'ID del libro' })
  @ApiBody({
    schema: { type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiResponse({ status: 200, description: 'Libro activado o desactivado para la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Escuela o asignación no encontrada.' })
  async setLibroActivoEnEscuela(
    @Param('id', ParseIntPipe) id: number,
    @Param('libroId', ParseIntPipe) libroId: number,
    @Body() body: { activo: boolean },
  ) {
    if (typeof body.activo !== 'boolean') {
      throw new BadRequestException('El body debe incluir "activo" (boolean).');
    }
    return await this.escuelasService.setLibroActivoEnEscuela(id, libroId, body.activo);
  }

  /**
   * GET /escuelas/:id/maestros
   * Listar maestros de la escuela. Admin: cualquier escuela. Director: solo su escuela.
   */
  @Get(':id/maestros')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Listar maestros de la escuela (admin o director de esa escuela)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Maestros de la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo puede ver su escuela).' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarMaestros(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.listarMaestrosDeEscuela(id);
  }

  /**
   * GET /escuelas/:id/alumnos
   * Listar alumnos de la escuela. Admin: cualquier escuela. Director: solo su escuela.
   */
  @Get(':id/alumnos')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Listar alumnos de la escuela (admin o director de esa escuela)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Alumnos de la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo puede ver su escuela).' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarAlumnos(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.listarAlumnosDeEscuela(id);
  }

  /**
   * GET /escuelas/:id/directores
   * Listar directores de la escuela. Admin: cualquier escuela. Director: solo su escuela.
   */
  @Get(':id/directores')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Listar directores de la escuela (admin o director de esa escuela)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Directores de la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo puede ver su escuela).' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarDirectores(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.listarDirectoresDeEscuela(id);
  }

  /**
   * POST /escuelas/:id/libros
   * PASO 1 - Admin otorga libro a la escuela. Crea pendiente de canje.
   * La escuela debe canjear el código para que el libro se active.
   */
  @Post(':id/libros')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Otorgar libro a la escuela (Paso 1: admin otorga; la escuela debe canjear después)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['codigo'],
      properties: { codigo: { type: 'string', example: 'LIB-1735123456-abc12345' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Libro otorgado. La escuela debe canjear el código.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Escuela o libro (código) no encontrado.' })
  @ApiResponse({ status: 409, description: 'Libro ya otorgado o ya canjeado.' })
  async otorgarLibro(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarLibroEscuelaDto,
  ) {
    return await this.escuelasService.otorgarLibroPorCodigo(id, dto.codigo);
  }

  /**
   * GET /escuelas/:id
   * Obtener una escuela por ID. Admin: cualquier escuela. Director: solo su escuela.
   */
  @Get(':id')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Obtener escuela por ID (admin o director de esa escuela)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({
    status: 200,
    description: 'Escuela encontrada',
    schema: {
      example: {
        message: 'Escuela obtenida exitosamente',
        description: 'La escuela fue encontrada en el sistema',
        data: {
          id: 1,
          nombre: 'Escuela Primaria Benito Juárez',
          nivel: 'Primaria',
          clave: '29DPR0123X',
          direccion: 'Calle Principal #123',
          telefono: '5551234567',
          alumnos: [],
          maestros: [],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo su escuela)' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada' })
  async obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.obtenerPorId(id);
  }

  /**
   * PUT /escuelas/:id
   * Actualizar una escuela (solo administradores)
   */
  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Actualizar una escuela (requiere admin)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({
    status: 200,
    description: 'Escuela actualizada exitosamente',
    schema: {
      example: {
        message: 'Escuela actualizada exitosamente',
        description: 'La información de la escuela ha sido actualizada correctamente.',
        data: {
          id: 1,
          nombre: 'Escuela Primaria Benito Juárez Actualizada',
          nivel: 'Primaria',
          clave: '29DPR0123X',
          direccion: 'Nueva Dirección #456',
          telefono: '5551234567',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada' })
  @ApiResponse({ status: 409, description: 'Escuela con nombre o clave duplicada' })
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() actualizarEscuelaDto: ActualizarEscuelaDto,
    @Request() req: ExpressRequest,
  ) {
    return await this.escuelasService.actualizar(id, actualizarEscuelaDto, getAuditContext(req));
  }

  /**
   * DELETE /escuelas/:id
   * Eliminar una escuela (solo administradores)
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Eliminar una escuela (requiere admin)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({
    status: 200,
    description: 'Escuela eliminada exitosamente',
    schema: {
      example: {
        message: 'Escuela eliminada exitosamente',
        description: 'La escuela ha sido eliminada del sistema.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar porque tiene alumnos o maestros asociados' })
  async eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    return await this.escuelasService.eliminar(id, getAuditContext(req));
  }
}
