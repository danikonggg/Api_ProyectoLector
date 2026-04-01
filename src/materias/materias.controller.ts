/**
 * Controlador de Materias.
 * GET /materias - todos (JWT para maestros/directores/admin)
 * POST/PATCH/DELETE - solo admin
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MateriasService } from './materias.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';

@Controller('materias')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MateriasController {
  constructor(private readonly materiasService: MateriasService) {}

  /**
   * GET /materias
   * Listar todas las materias. Útil para dropdowns al asignar alumnos o crear libros.
   */
  @Get()
  @ApiTags('Materias')
  @ApiOperation({ summary: 'Listar todas las materias' })
  @ApiResponse({ status: 200, description: 'Lista de materias' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async findAll() {
    return this.materiasService.findAll();
  }

  /**
   * GET /materias/:id
   * Obtener una materia por ID.
   */
  @Get(':id')
  @ApiTags('Materias')
  @ApiOperation({ summary: 'Obtener materia por ID' })
  @ApiParam({ name: 'id', description: 'ID de la materia' })
  @ApiResponse({ status: 200, description: 'Materia encontrada' })
  @ApiResponse({ status: 404, description: 'Materia no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.materiasService.findOne(id);
  }

  /**
   * POST /materias
   * Crear materia. Solo admin.
   */
  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Crear materia' })
  @ApiResponse({ status: 201, description: 'Materia creada' })
  @ApiResponse({ status: 409, description: 'Ya existe materia con ese nombre' })
  async create(@Body() dto: CreateMateriaDto) {
    return this.materiasService.create(dto);
  }

  /**
   * PATCH /materias/:id
   * Actualizar materia. Solo admin.
   */
  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Actualizar materia' })
  @ApiParam({ name: 'id', description: 'ID de la materia' })
  @ApiResponse({ status: 200, description: 'Materia actualizada' })
  @ApiResponse({ status: 404, description: 'Materia no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMateriaDto,
  ) {
    return this.materiasService.update(id, dto);
  }

  /**
   * DELETE /materias/:id
   * Eliminar materia. Solo admin. Falla si la materia está en uso.
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Eliminar materia' })
  @ApiParam({ name: 'id', description: 'ID de la materia' })
  @ApiResponse({ status: 200, description: 'Materia eliminada' })
  @ApiResponse({ status: 404, description: 'Materia no encontrada' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.materiasService.remove(id);
  }
}
