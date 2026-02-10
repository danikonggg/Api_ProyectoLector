/**
 * ============================================
 * CONTROLADOR: DirectorController
 * ============================================
 * Endpoints exclusivos para directores de escuela.
 * El director nunca envía el ID de escuela: se usa el del token.
 */

import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DirectorGuard } from '../auth/guards/director.guard';
import { DirectorService } from './director.service';
import { EscuelasService } from '../escuelas/escuelas.service';
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
    description: 'Solo se envía el código en el body. No se envía ni se pide ID de escuela; se usa la del director (token).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['codigo'],
      properties: { codigo: { type: 'string', example: 'LIB-1735123456-abc12345', description: 'Código que entregó el administrador' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Libro canjeado' })
  @ApiResponse({ status: 400, description: 'Código no otorgado a tu escuela' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo directores' })
  async canjearLibro(
    @Body('codigo') codigo: string,
    @Request() req: ExpressRequest & { user?: { director?: { escuelaId?: number; escuela?: { id: number } } } },
  ) {
    const escuelaId = getEscuelaId(req);
    if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
      throw new BadRequestException('El código es obligatorio');
    }
    return await this.escuelasService.canjearLibroPorCodigo(escuelaId, codigo.trim(), getAuditContext(req));
  }
}
