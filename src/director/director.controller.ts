import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request, ForbiddenException, BadRequestException, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DirectorGuard } from '../auth/guards/director.guard';
import { DirectorService } from './director.service';
import { EscuelasService } from '../escuelas/escuelas.service';
import { AsignarLibroEscuelaDto } from '../escuelas/dto/asignar-libro-escuela.dto';
import { AsignarLibroAlumnoDto } from '../escuelas/dto/asignar-libro-alumno.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import * as multer from 'multer';
import { CargaMasivaService } from '../personas/carga-masiva.service';
import type { Request as ExpressRequest } from 'express';

function getEscuelaId(req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }): number {
  const escuelaId = req.user?.director?.escuelaId ?? req.user?.director?.escuela?.id;
  if (!escuelaId) {
    throw new ForbiddenException('No se encontró la escuela del director');
  }
  return Number(escuelaId);
}

function getAuditContext(req: ExpressRequest) {
  const ip = req.ip ?? (Array.isArray(req.headers?.['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers?.['x-forwarded-for']) ?? req.headers?.['x-real-ip'];
  return {
    usuarioId: (req.user as any)?.id ?? null,
    ip: typeof ip === 'string' ? ip : undefined,
  };
}

@Controller('director')
@UseGuards(JwtAuthGuard, DirectorGuard)
@ApiBearerAuth('JWT-auth')
export class DirectorController {
  constructor(
    private readonly directorService: DirectorService,
    private readonly escuelasService: EscuelasService,
    private readonly cargaMasivaService: CargaMasivaService,
  ) {}

  /**
   * GET /director/dashboard
   * Dashboard con datos de la escuela del director.
   */
  @Get('dashboard')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Dashboard director: escuela, estudiantes, profesores, libros' })
  @ApiResponse({ status: 200, description: 'Estadísticas de la escuela del director' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getDashboard(@Request() req: ExpressRequest & { user?: { director?: { escuelaId: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.directorService.getDashboard(escuelaId);
  }

  /**
   * GET /director/escuela
   * Datos de mi escuela. El ID se obtiene del token; no se envía en la URL.
   */
  @Get('escuela')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Ver datos de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Datos de la escuela del director' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getMiEscuela(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.obtenerPorId(escuelaId);
  }

  /**
   * GET /director/maestros
   * Maestros de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('maestros')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Maestros de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de maestros' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getMaestros(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarMaestrosDeEscuela(escuelaId);
  }

  /**
   * GET /director/alumnos
   * Alumnos de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('alumnos')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Alumnos de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de alumnos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getAlumnos(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarAlumnosDeEscuela(escuelaId);
  }

  /**
   * GET /director/directores
   * Directores de mi escuela. El ID de escuela se obtiene del token.
   */
  @Get('directores')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Directores de mi escuela', description: 'Sin parámetros. La escuela se toma del token.' })
  @ApiResponse({ status: 200, description: 'Lista de directores de la escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getDirectores(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarDirectoresDeEscuela(escuelaId);
  }

  /**
   * GET /director/libros
   * Libros activos de la escuela del director (sin enviar ID de escuela).
   */
  @Get('libros')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Libros activos de mi escuela',
    description: 'Sin parámetros. La escuela se toma del token del director. No se envía ID de escuela.',
  })
  @ApiResponse({ status: 200, description: 'Libros ya canjeados en mi escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getLibros(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarLibrosDeEscuela(escuelaId);
  }

  /**
   * GET /director/libros/pendientes
   * Libros otorgados por admin pendientes de canjear (sin enviar ID de escuela).
   */
  @Get('libros/pendientes')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Libros pendientes de canjear en mi escuela',
    description: 'Sin parámetros. La escuela se toma del token. No se envía ID de escuela.',
  })
  @ApiResponse({ status: 200, description: 'Pendientes de canjear' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async getLibrosPendientes(@Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } }) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.listarLibrosPendientesDeEscuela(escuelaId, true);
  }

  /**
   * POST /director/canjear-libro
   * Canjear libro con el código que dio el admin. No se envía ID de escuela (se usa la del director).
   */
  @Post('canjear-libro')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Canjear libro en mi escuela (solo código)',
    description: 'Body: { "codigo": "..." }. No se envía ID de escuela; se usa la del director (token).',
  })
  @ApiResponse({ status: 201, description: 'Libro canjeado' })
  @ApiResponse({ status: 400, description: 'Código inválido o no otorgado a tu escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async canjearLibro(
    @Body() body: AsignarLibroEscuelaDto,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    return await this.escuelasService.canjearLibroPorCodigo(escuelaId, body.codigo, getAuditContext(req));
  }

  /**
   * POST /director/carga-masiva
   * Carga masiva de alumnos o maestros desde Excel. Usa la escuela del director.
   */
  @Post('carga-masiva')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiTags('Solo Director')
  @ApiOperation({
    summary: 'Carga masiva desde Excel',
    description: 'Sube Excel con: nombre, apellidoPaterno, apellidoMaterno, email, [password], [grado], [grupo]. Tipo: alumno o maestro.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'tipo'],
      properties: {
        file: { type: 'string', format: 'binary' },
        tipo: { type: 'string', enum: ['alumno', 'maestro'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Creados, errores, credenciales, excelBase64' })
  @ApiResponse({ status: 400, description: 'Archivo o tipo inválido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async cargaMasiva(
    @UploadedFile() file: { buffer: Buffer },
    @Body() body: { tipo?: string },
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    if (!file?.buffer) throw new BadRequestException('Debes enviar un archivo Excel (campo "file").');
    const tipoNorm = (body?.tipo || 'alumno').toLowerCase();
    if (tipoNorm !== 'alumno' && tipoNorm !== 'maestro') {
      throw new BadRequestException('El tipo debe ser "alumno" o "maestro".');
    }

    const filas =
      tipoNorm === 'alumno'
        ? this.cargaMasivaService.parseExcelAlumnos(file.buffer)
        : this.cargaMasivaService.parseExcelMaestros(file.buffer);

    if (filas.length === 0) {
      throw new BadRequestException(
        'El Excel está vacío o no tiene el formato correcto. Obligatorias: nombre, email (o correo). Opcionales: apellidoPaterno, apellidoMaterno, password (si no se envía se genera automática).',
      );
    }

    const resultado =
      tipoNorm === 'alumno'
        ? await this.cargaMasivaService.cargarAlumnos(escuelaId, filas, getAuditContext(req))
        : await this.cargaMasivaService.cargarMaestros(escuelaId, filas, getAuditContext(req));

    const excelBase64 =
      resultado.credenciales.length > 0
        ? (await this.cargaMasivaService.generarExcelCredenciales(resultado.credenciales)).toString('base64')
        : null;

    return {
      message: `Carga masiva completada. Creados: ${resultado.credenciales.length}, errores: ${resultado.errores.length}`,
      creados: resultado.credenciales.length,
      totalErrores: resultado.errores.length,
      credenciales: resultado.credenciales,
      detalleErrores: resultado.errores,
      excelBase64,
    };
  }

  /**
   * GET /director/libros-disponibles-para-asignar
   * Libros disponibles para asignar a un alumno (mismo grado, grupo).
   */
  @Get('libros-disponibles-para-asignar')
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Libros disponibles para asignar a un alumno' })
  @ApiResponse({ status: 200, description: 'Libros que coinciden con grado y grupo del alumno' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async librosDisponiblesParaAsignar(
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
    @Query('alumnoId') alumnoIdStr: string,
  ) {
    const escuelaId = getEscuelaId(req);
    const alumnoId = parseInt(alumnoIdStr, 10);
    if (isNaN(alumnoId)) throw new ForbiddenException('alumnoId debe ser un número');
    return await this.escuelasService.listarLibrosDisponiblesParaAsignar(escuelaId, alumnoId);
  }

  /**
   * POST /director/asignar-libro
   * Asignar un libro a un alumno.
   */
  @Post('asignar-libro')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Asignar libro a alumno' })
  @ApiResponse({ status: 201, description: 'Libro asignado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o libro no disponible' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Alumno o libro no encontrados' })
  @ApiResponse({ status: 409, description: 'Libro ya asignado al alumno' })
  async asignarLibro(
    @Body() dto: AsignarLibroAlumnoDto,
    @Request() req: ExpressRequest & { user?: { director?: { id: number; escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    const directorId = req.user?.director?.id;
    if (!directorId) throw new ForbiddenException('No se encontró el director');
    return await this.escuelasService.asignarLibroAlAlumno(
      escuelaId,
      dto.alumnoId,
      dto.libroId,
      'director',
      directorId,
    );
  }

  /**
   * DELETE /director/desasignar-libro/:alumnoId/:libroId
   * Desasignar un libro de un alumno.
   */
  @Delete('desasignar-libro/:alumnoId/:libroId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Solo Director')
  @ApiOperation({ summary: 'Desasignar libro de alumno' })
  @ApiResponse({ status: 200, description: 'Libro desasignado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async desasignarLibro(
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    return await this.escuelasService.desasignarLibroAlAlumno(alumnoId, libroId);
  }
}
