/**
 * ============================================
 * CONTROLADOR: MaestrosController
 * ============================================
 * Endpoints para que los maestros gestionen a sus alumnos.
 * Todos requieren JWT + MaestroGuard.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { MaestrosService } from './maestros.service';
import { EscuelasService } from '../escuelas/escuelas.service';
import { AsignarAlumnoDto } from './dto/asignar-alumno.dto';
import { AsignarLibroAlumnoDto } from '../escuelas/dto/asignar-libro-alumno.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MaestroGuard } from '../auth/guards/maestro.guard';

@Controller('maestros')
@UseGuards(JwtAuthGuard, MaestroGuard)
@ApiBearerAuth('JWT-auth')
export class MaestrosController {
  constructor(
    private readonly maestrosService: MaestrosService,
    private readonly escuelasService: EscuelasService,
  ) {}

  /**
   * GET /maestros/mis-alumnos
   * Listar alumnos asignados al maestro.
   */
  @Get('mis-alumnos')
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Listar mis alumnos (requiere maestro)' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos asignados' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es maestro' })
  async obtenerMisAlumnos(@Req() req: Request) {
    const user = req.user as any;
    return this.maestrosService.obtenerMisAlumnos(user.maestro.id);
  }

  /**
   * GET /maestros/mis-alumnos/:id
   * Obtener un alumno por ID. Solo si está asignado al maestro.
   */
  @Get('mis-alumnos/:id')
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Obtener un alumno (solo si está en tu clase)' })
  @ApiParam({ name: 'id', description: 'ID del alumno' })
  @ApiResponse({ status: 200, description: 'Alumno encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es maestro' })
  @ApiResponse({ status: 404, description: 'Alumno no encontrado o no asignado' })
  async obtenerAlumnoPorId(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as any;
    return this.maestrosService.obtenerAlumnoPorId(user.maestro.id, id);
  }

  /**
   * POST /maestros/asignar-alumno
   * Asignar un alumno a la clase del maestro (por materia).
   * El alumno debe ser de la misma escuela.
   */
  @Post('asignar-alumno')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Asignar alumno a mi clase (misma escuela)' })
  @ApiResponse({ status: 201, description: 'Alumno asignado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es maestro o alumno de otra escuela' })
  @ApiResponse({ status: 404, description: 'Alumno o materia no encontrados' })
  @ApiResponse({ status: 409, description: 'Alumno ya asignado en esta materia' })
  async asignarAlumno(@Req() req: Request, @Body() dto: AsignarAlumnoDto) {
    const user = req.user as any;
    return this.maestrosService.asignarAlumno(user.maestro.id, dto);
  }

  /**
   * GET /maestros/libros-disponibles-para-asignar
   * Libros de la escuela que puede asignar a un alumno (mismo grado, grupo).
   */
  @Get('libros-disponibles-para-asignar')
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Libros disponibles para asignar a un alumno' })
  @ApiResponse({ status: 200, description: 'Libros que coinciden con grado y grupo del alumno' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo maestros' })
  async librosDisponiblesParaAsignar(
    @Req() req: Request,
    @Query('alumnoId') alumnoIdStr: string,
  ) {
    const user = req.user as any;
    const escuelaId = user.maestro?.escuelaId ?? user.maestro?.escuela?.id;
    if (!escuelaId) throw new ForbiddenException('No se encontró la escuela del maestro');
    const alumnoId = parseInt(alumnoIdStr, 10);
    if (isNaN(alumnoId)) throw new BadRequestException('alumnoId debe ser un número');
    return this.escuelasService.listarLibrosDisponiblesParaAsignar(escuelaId, alumnoId);
  }

  /**
   * POST /maestros/asignar-libro
   * Asignar un libro a un alumno (el alumno debe estar en tu clase o ser de tu escuela).
   */
  @Post('asignar-libro')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Asignar libro a alumno' })
  @ApiResponse({ status: 201, description: 'Libro asignado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o libro no disponible' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo maestros' })
  @ApiResponse({ status: 404, description: 'Alumno o libro no encontrados' })
  @ApiResponse({ status: 409, description: 'Libro ya asignado al alumno' })
  async asignarLibro(@Req() req: Request, @Body() dto: AsignarLibroAlumnoDto) {
    const user = req.user as any;
    const escuelaId = user.maestro?.escuelaId ?? user.maestro?.escuela?.id;
    if (!escuelaId) throw new ForbiddenException('No se encontró la escuela del maestro');
    return this.escuelasService.asignarLibroAlAlumno(
      escuelaId,
      dto.alumnoId,
      dto.libroId,
      'maestro',
      user.maestro.id,
    );
  }

  /**
   * DELETE /maestros/desasignar-libro/:alumnoId/:libroId
   * Desasignar un libro de un alumno.
   */
  @Delete('desasignar-libro/:alumnoId/:libroId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Desasignar libro de alumno' })
  @ApiParam({ name: 'alumnoId', description: 'ID del alumno' })
  @ApiParam({ name: 'libroId', description: 'ID del libro' })
  @ApiResponse({ status: 200, description: 'Libro desasignado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo maestros' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async desasignarLibro(
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    return this.escuelasService.desasignarLibroAlAlumno(alumnoId, libroId);
  }

  /**
   * DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId
   * Desasignar un alumno de la clase.
   */
  @Delete('mis-alumnos/:alumnoId/materia/:materiaId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Maestro')
  @ApiOperation({ summary: 'Desasignar alumno de mi clase' })
  @ApiParam({ name: 'alumnoId', description: 'ID del alumno' })
  @ApiParam({ name: 'materiaId', description: 'ID de la materia' })
  @ApiResponse({ status: 200, description: 'Alumno desasignado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No es maestro' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async desasignarAlumno(
    @Req() req: Request,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    const user = req.user as any;
    return this.maestrosService.desasignarAlumno(
      user.maestro.id,
      alumnoId,
      materiaId,
    );
  }
}
