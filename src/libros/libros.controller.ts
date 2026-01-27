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
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
import { LibrosService } from './libros.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';

const PDF_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

@ApiTags('Libros')
@Controller('libros')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class LibrosController {
  constructor(private readonly librosService: LibrosService) {}

  /**
   * POST /libros/cargar
   * Subir PDF + metadatos. Backend extrae texto, limpia, segmenta, guarda.
   */
  @Post('cargar')
  @HttpCode(HttpStatus.CREATED)
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
    return this.librosService.cargar(file.buffer, dto);
  }

  /**
   * GET /libros
   * Listar todos los libros.
   */
  @Get()
  @ApiOperation({ summary: 'Listar libros. Requiere admin.' })
  @ApiResponse({ status: 200, description: 'Lista de libros.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  async listar() {
    return this.librosService.listar();
  }

  /**
   * GET /libros/:id
   * Obtener libro con unidades y segmentos (contenido listo para front).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener libro por ID (unidades + segmentos). Requiere admin.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Libro con unidades y segmentos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.librosService.obtenerPorId(id);
  }
}
