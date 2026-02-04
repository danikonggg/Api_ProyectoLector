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
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { EscuelasService } from './escuelas.service';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { AsignarLibroEscuelaDto } from './dto/asignar-libro-escuela.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { AlumnoGuard } from '../auth/guards/alumno.guard';

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

@ApiTags('Escuelas')
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
  async crear(@Body() crearEscuelaDto: CrearEscuelaDto) {
    return await this.escuelasService.crear(crearEscuelaDto);
  }

  /**
   * GET /escuelas
   * Obtener todas las escuelas (solo administradores)
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Listar todas las escuelas (requiere admin)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de escuelas',
    schema: {
      example: {
        message: 'Escuelas obtenidas exitosamente',
        description: 'Se encontraron 5 escuela(s) en el sistema',
        total: 5,
        data: [
          {
            id: 1,
            nombre: 'Escuela Primaria Benito Juárez',
            nivel: 'Primaria',
            clave: '29DPR0123X',
            direccion: 'Calle Principal #123',
            telefono: '5551234567',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  async obtenerTodas() {
    return await this.escuelasService.obtenerTodas();
  }

  /**
   * GET /escuelas/mis-libros
   * Libros de la escuela del alumno autenticado.
   */
  @Get('mis-libros')
  @UseGuards(AlumnoGuard)
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
  @UseGuards(AdminOrDirectorGuard)
  @ApiOperation({ summary: 'Libros pendientes de canjear (otorgados por admin)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Libros pendientes de canjear.' })
  @ApiResponse({ status: 403, description: 'Director solo puede ver su escuela.' })
  async listarLibrosPendientes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    const esDirector = req.user?.tipoPersona === 'director';
    return await this.escuelasService.listarLibrosPendientesDeEscuela(id, esDirector);
  }

  /**
   * POST /escuelas/:id/libros/canjear
   * La escuela (director) canjea el código. Solo si el admin ya otorgó ese libro.
   */
  @Post(':id/libros/canjear')
  @UseGuards(AdminOrDirectorGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Canjear libro (Paso 2: escuela canjea código otorgado por admin)' })
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
  @ApiResponse({ status: 403, description: 'Director solo puede canjear en su escuela.' })
  async canjearLibro(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarLibroEscuelaDto,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.canjearLibroPorCodigo(id, dto.codigo);
  }

  /**
   * GET /escuelas/:id/libros
   * Listar libros activos de la escuela (solo los ya canjeados).
   */
  @Get(':id/libros')
  @UseGuards(AdminOrDirectorGuard)
  @ApiOperation({ summary: 'Listar libros activos de la escuela (canjeados)' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Libros activos de la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo puede ver su escuela).' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada.' })
  async listarLibros(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    directorSoloSuEscuela(req.user, id);
    return await this.escuelasService.listarLibrosDeEscuela(id);
  }

  /**
   * GET /escuelas/:id/maestros
   * Listar maestros de la escuela. Admin: cualquier escuela. Director: solo su escuela.
   */
  @Get(':id/maestros')
  @UseGuards(AdminOrDirectorGuard)
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
   * POST /escuelas/:id/libros
   * PASO 1 - Admin otorga libro a la escuela. Crea pendiente de canje.
   * La escuela debe canjear el código para que el libro se active.
   */
  @Post(':id/libros')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
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
  ) {
    return await this.escuelasService.actualizar(id, actualizarEscuelaDto);
  }

  /**
   * DELETE /escuelas/:id
   * Eliminar una escuela (solo administradores)
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
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
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    return await this.escuelasService.eliminar(id);
  }
}
