/**
 * ============================================
 * CONTROLADOR: LibrosController
 * ============================================
 * Admin carga PDF → backend extrae texto, segmenta, persiste.
 * Sin IA por ahora.
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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Request,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { AdminOrDirectorOrAlumnoGuard } from '../auth/guards/admin-or-director-or-alumno.guard';
import { LibrosService } from './libros.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';
import type { AuditContext } from './libros.service';
import type { Request as ExpressRequest } from 'express';

function getAuditContext(req: ExpressRequest): AuditContext {
  const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
  return {
    usuarioId: (req.user as any)?.id ?? null,
    ip: typeof ip === 'string' ? ip : undefined,
  };
}

const PDF_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

@Controller('libros')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class LibrosController {
  constructor(private readonly librosService: LibrosService) {}

  /**
   * POST /libros/cargar
   * Subir PDF + metadatos. Backend extrae texto, limpia, segmenta, guarda.
   */
  @Post('cargar')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Administrador')
  @UseInterceptors(
    FileInterceptor('pdf', {
      storage: multer.memoryStorage(),
      limits: { fileSize: PDF_MAX_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf', 'titulo', 'grado'],
      properties: {
        pdf: { type: 'string', format: 'binary', description: 'Archivo PDF' },
        titulo: { type: 'string', example: 'El principito' },
        grado: { type: 'number', example: 5 },
        materiaId: { type: 'number', example: 1, description: 'Opcional; solo lectura sin materia' },
        codigo: { type: 'string', example: 'LECT-2024' },
        descripcion: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Cargar libro (PDF + metadatos). Requiere admin.' })
  @ApiResponse({ status: 201, description: 'Libro procesado y guardado.' })
  @ApiResponse({ status: 400, description: 'PDF inválido o sin texto.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  async cargar(
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname?: string },
    @Body() dto?: CargarLibroDto,
    @Request() req?: ExpressRequest,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Debes enviar un archivo PDF.');
    }
    if (!dto) {
      throw new BadRequestException('Faltan metadatos: titulo, grado.');
    }
    const ok =
      file.mimetype === 'application/pdf' ||
      (file.originalname && file.originalname.toLowerCase().endsWith('.pdf'));
    if (!ok) {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }
    return this.librosService.cargar(file.buffer, dto, req ? getAuditContext(req) : undefined);
  }

  /**
   * GET /libros
   * Listar todos los libros (solo admin).
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar libros. Requiere admin.' })
  @ApiResponse({ status: 200, description: 'Lista de libros.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  async listar() {
    return this.librosService.listar();
  }

  /**
   * GET /libros/:id/pdf
   * Descargar el PDF. Solo administradores.
   */
  @Get(':id/pdf')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Descargar PDF. Solo administradores.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Archivo PDF.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  @ApiResponse({ status: 404, description: 'Libro o PDF no encontrado.' })
  async descargarPdf(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const ruta = await this.librosService.rutaPdfAbsoluta(id);
    if (!ruta) {
      throw new NotFoundException('No se encontró el PDF para este libro.');
    }
    const stream = createReadStream(ruta);
    return new StreamableFile(stream, { type: 'application/pdf' });
  }

  /**
   * GET /libros/:id/escuelas
   * Ver escuelas que tienen este libro (para asignar/desasignar desde la pantalla del libro).
   */
  @Get(':id/escuelas')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Ver escuelas de este libro (admin)',
    description: 'Lista de escuelas que tienen el libro asignado, con activoEnEscuela. Usar con PATCH .../escuelas/:escuelaId/activo para activar o quitar.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'ID del libro' })
  @ApiResponse({ status: 200, description: 'Lista de escuelas con activoEnEscuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async listarEscuelasDeLibro(@Param('id', ParseIntPipe) id: number) {
    return this.librosService.listarEscuelasDeLibro(id);
  }

  /**
   * PATCH /libros/:id/escuelas/:escuelaId/activo
   * Activar o desactivar este libro en una escuela (desde la pantalla del libro).
   */
  @Patch(':id/escuelas/:escuelaId/activo')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Activar/desactivar libro en una escuela. Requiere admin.' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID del libro' })
  @ApiParam({ name: 'escuelaId', type: 'number', description: 'ID de la escuela' })
  @ApiBody({
    schema: { type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiResponse({ status: 200, description: 'Libro activado o desactivado para la escuela.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo administradores.' })
  @ApiResponse({ status: 404, description: 'Libro o asignación no encontrada.' })
  async setLibroActivoEnEscuela(
    @Param('id', ParseIntPipe) id: number,
    @Param('escuelaId', ParseIntPipe) escuelaId: number,
    @Body() body: { activo: boolean },
    @Request() req: ExpressRequest,
  ) {
    if (typeof body.activo !== 'boolean') {
      throw new BadRequestException('El body debe incluir "activo" (boolean).');
    }
    return this.librosService.setLibroActivoEnEscuela(id, escuelaId, body.activo);
  }

  /**
   * GET /libros/:id
   * Obtener libro con unidades y segmentos. Admin, director o alumno (solo libros de su escuela).
   */
  @Get(':id')
  @UseGuards(AdminOrDirectorOrAlumnoGuard)
  @ApiTags('Admin, Director o Alumno')
  @ApiOperation({ summary: 'Obtener libro por ID. Alumnos solo ven libros de su escuela.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Libro con unidades y segmentos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { tipoPersona?: string; alumno?: { escuelaId: number } } },
  ) {
    if (req.user?.tipoPersona === 'alumno' && req.user?.alumno?.escuelaId) {
      const puede = await this.librosService.libroPerteneceAEscuela(
        id,
        req.user.alumno.escuelaId,
      );
      if (!puede) {
        throw new ForbiddenException(
          'Este libro no está asignado a tu escuela.',
        );
      }
    }
    return this.librosService.obtenerPorId(id);
  }

  /**
   * PATCH /libros/:id/activo
   * Activar o desactivar un libro globalmente. Si se desactiva, se desactiva en todas las escuelas.
   */
  @Patch(':id/activo')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Activar/desactivar libro globalmente. Requiere admin.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    schema: { type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiResponse({ status: 200, description: 'Libro activado o desactivado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async setActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { activo: boolean },
    @Request() req: ExpressRequest,
  ) {
    if (typeof body.activo !== 'boolean') {
      throw new BadRequestException('El body debe incluir "activo" (boolean).');
    }
    return this.librosService.setActivoGlobal(id, body.activo, getAuditContext(req));
  }

  /**
   * DELETE /libros/:id
   * Elimina el libro por completo: asignaciones a escuelas, PDF, unidades, segmentos.
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Eliminar libro por completo. Requiere admin.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Libro eliminado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    return this.librosService.eliminar(id, getAuditContext(req));
  }
}
