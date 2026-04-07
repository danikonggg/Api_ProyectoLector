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
  Query,
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
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { AdminOrDirectorOrAlumnoGuard } from '../auth/guards/admin-or-director-or-alumno.guard';
import { LibrosService } from './libros.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { EscuelasService } from '../escuelas/escuelas.service';
import { CargarLibroDto } from './dto/cargar-libro.dto';
import { getAuditContext } from '../common/utils/audit.utils';
import { ListarLibrosQueryDto } from './dto/listar-libros-query.dto';
import type { Request as ExpressRequest } from 'express';

const PDF_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

@Controller('libros')
@ApiBearerAuth('JWT-auth')
export class LibrosController {
  constructor(
    private readonly librosService: LibrosService,
    private readonly librosPdfImagenesService: LibrosPdfImagenesService,
    private readonly escuelasService: EscuelasService,
  ) {}

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
  @ApiOperation({
    summary: 'Cargar libro (PDF + metadatos). Requiere admin. Pipeline: validación → extracción → unidades por capítulos.',
  })
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
   * POST /libros/probar-paginas-imagen
   * PRUEBA: Sube un PDF y extrae cada página como imagen. Devuelve URLs para consumir imagen por imagen.
   * No modifica el flujo normal de cargar libros.
   */
  @Post('probar-paginas-imagen')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Prueba - Imágenes por página')
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
      required: ['pdf'],
      properties: { pdf: { type: 'string', format: 'binary', description: 'Archivo PDF' } },
    },
  })
  @ApiOperation({
    summary: '[PRUEBA] Extraer PDF página por página como imágenes',
    description: 'Sube un PDF y recibe URLs para cada página en formato imagen. Para probar en el front.',
  })
  @ApiResponse({ status: 200, description: 'sessionId, numPaginas y array de { numero, url }.' })
  async probarPaginasImagen(
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname?: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Debes enviar un archivo PDF.');
    }
    const ok =
      file.mimetype === 'application/pdf' ||
      (file.originalname && file.originalname.toLowerCase().endsWith('.pdf'));
    if (!ok) {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }
    return this.librosPdfImagenesService.extraerPaginasComoImagenes(file.buffer);
  }

  /**
   * GET /libros/probar-paginas-imagen/:sessionId/:numero
   * Sirve la imagen PNG de una página generada por POST probar-paginas-imagen.
   */
  @Get('probar-paginas-imagen/:sessionId/:numero')
  @ApiTags('Prueba - Imágenes por página')
  @ApiOperation({ summary: '[PRUEBA] Obtener imagen de una página' })
  @ApiParam({ name: 'sessionId', description: 'ID de sesión retornado por POST probar-paginas-imagen' })
  @ApiParam({ name: 'numero', description: 'Número de página (1, 2, 3...)' })
  @ApiResponse({ status: 200, description: 'Imagen PNG.' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada.' })
  async servirImagenPrueba(
    @Param('sessionId') sessionId: string,
    @Param('numero', ParseIntPipe) numero: number,
  ): Promise<StreamableFile> {
    const ruta = await this.librosPdfImagenesService.rutaImagenPrueba(sessionId, numero);
    if (!ruta) {
      throw new NotFoundException(`No se encontró la imagen de la página ${numero}.`);
    }
    const stream = createReadStream(ruta);
    return new StreamableFile(stream, { type: 'image/png' });
  }

  /**
   * GET /libros
   * Listar todos los libros (solo admin).
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar libros con paginación. Requiere admin.' })
  @ApiResponse({ status: 200, description: 'Lista de libros con meta (page, limit, totalPages).' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No es administrador.' })
  async listar(@Query() query: ListarLibrosQueryDto) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    return this.librosService.listar(page, limit);
  }

  /**
   * GET /libros/:id/paginas/:numero/imagen
   * Sirve la imagen (captura) de una página del libro. Mismo formato que el libro, página por página.
   */
  @Get(':id/paginas/:numero/imagen')
  @UseGuards(AdminOrDirectorOrAlumnoGuard)
  @ApiTags('Libros')
  @ApiOperation({ summary: 'Obtener imagen de una página del libro' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID del libro' })
  @ApiParam({ name: 'numero', type: 'number', description: 'Número de página (1, 2, 3...)' })
  @ApiResponse({ status: 200, description: 'Imagen PNG de la página.' })
  @ApiResponse({ status: 404, description: 'Libro o imagen no encontrada.' })
  async servirImagenPaginaLibro(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
  ): Promise<StreamableFile> {
    const { id: libroId, codigo } = await this.librosService.obtenerLibroBasico(id);
    const ruta = await this.librosPdfImagenesService.rutaImagenPaginaLibro(libroId, codigo, numero);
    if (!ruta) {
      throw new NotFoundException(`No se encontró la imagen de la página ${numero}. Es posible que el libro se haya cargado sin generar imágenes.`);
    }
    const stream = createReadStream(ruta);
    return new StreamableFile(stream, { type: 'image/png' });
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
   * GET /libros/:id/estado
   * Estado del libro (procesamiento async o debugging).
   */
  @Get(':id/estado')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Obtener estado de procesamiento del libro.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Estado del libro (estado, mensajeError, jobId).' })
  async obtenerEstado(@Param('id', ParseIntPipe) id: number) {
    return this.librosService.obtenerEstado(id);
  }

  /**
   * GET /libros/:id
   * Obtener libro con unidades y segmentos. Admin/director: cualquier libro de la escuela.
   * Alumno: solo libros asignados explícitamente (Alternativa C).
   */
  @Get(':id')
  @UseGuards(AdminOrDirectorOrAlumnoGuard)
  @ApiTags('Admin, Director o Alumno')
  @ApiOperation({ summary: 'Obtener libro por ID. Alumnos solo ven libros asignados.' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Libro con unidades y segmentos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Libro no encontrado.' })
  async obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { tipoPersona?: string; alumno?: { id: number; escuelaId: number } } },
  ) {
    if (req.user?.tipoPersona === 'alumno' && req.user?.alumno?.id) {
      const asignado = await this.escuelasService.libroAsignadoAlAlumno(
        req.user.alumno.id,
        id,
      );
      if (!asignado) {
        throw new ForbiddenException(
          'Este libro no te ha sido asignado. Pide a tu maestro o director que te lo asigne.',
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
