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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { EscuelasService } from './escuelas.service';
import { CrearEscuelaDto } from './dto/crear-escuela.dto';
import { ActualizarEscuelaDto } from './dto/actualizar-escuela.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Escuelas')
@Controller('escuelas')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class EscuelasController {
  constructor(private readonly escuelasService: EscuelasService) {}

  /**
   * POST /escuelas
   * Crear una nueva escuela (solo administradores)
   */
  @Post()
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
   * GET /escuelas/:id
   * Obtener una escuela por ID (solo administradores)
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una escuela por ID (requiere admin)' })
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
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Escuela no encontrada' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return await this.escuelasService.obtenerPorId(id);
  }

  /**
   * PUT /escuelas/:id
   * Actualizar una escuela (solo administradores)
   */
  @Put(':id')
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
