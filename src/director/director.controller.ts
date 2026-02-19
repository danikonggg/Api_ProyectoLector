import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DirectorGuard } from '../auth/guards/director.guard';
import { DirectorService } from './director.service';
import { EscuelasService } from '../escuelas/escuelas.service';
import { AsignarLibroEscuelaDto } from '../escuelas/dto/asignar-libro-escuela.dto';
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
}
