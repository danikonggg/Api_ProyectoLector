/**
 * ============================================
 * CONTROLADOR: LicenciasController
 * ============================================
 * Admin: generar, listar, exportar, activar/desactivar.
 * Director/Maestro: listar disponibles, asignar (vía EscuelasService).
 * Alumno: canjear con clave.
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
  Request,
  ForbiddenException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LicenciasService } from './licencias.service';
import { getAuditContext } from '../common/utils/audit.utils';
import { CrearLicenciasDto } from './dto/crear-licencias.dto';
import { CanjearLicenciaDto } from './dto/canjear-licencia.dto';
import { ArchivarVencidasDto } from './dto/archivar-vencidas.dto';
import { EliminarLicenciasDisponiblesDto } from './dto/eliminar-licencias-disponibles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOrDirectorGuard } from '../auth/guards/admin-or-director.guard';
import { AlumnoGuard } from '../auth/guards/alumno.guard';

type ReqUser = {
  tipoPersona?: string;
  alumno?: { id: number; escuelaId: number };
  director?: { id: number; escuelaId: number };
  maestro?: { id: number; escuelaId: number };
};

@Controller('licencias')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class LicenciasController {
  constructor(private readonly licenciasService: LicenciasService) {}

  /**
   * POST /licencias/generar
   * Admin genera lote de licencias.
   */
  @Post('generar')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Generar lote de licencias para escuela y libro' })
  @ApiResponse({ status: 201, description: 'Licencias generadas correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o libro desactivado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async generar(@Body() dto: CrearLicenciasDto) {
    return await this.licenciasService.generar(
      dto.escuelaId,
      dto.libroId,
      dto.cantidad,
      dto.fechaVencimiento,
    );
  }

  /**
   * GET /licencias
   * Admin: listar licencias con filtros.
   */
  @Get()
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar licencias (filtros: escuelaId, libroId, estado)' })
  @ApiQuery({ name: 'escuelaId', required: false, type: Number })
  @ApiQuery({ name: 'libroId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: ['disponible', 'usada', 'vencida'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de licencias' })
  async listar(
    @Query('escuelaId') escuelaIdStr?: string,
    @Query('libroId') libroIdStr?: string,
    @Query('estado') estado?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const escuelaId = escuelaIdStr && !isNaN(parseInt(escuelaIdStr, 10)) ? parseInt(escuelaIdStr, 10) : undefined;
    const libroId = libroIdStr && !isNaN(parseInt(libroIdStr, 10)) ? parseInt(libroIdStr, 10) : undefined;
    const page = pageStr && !isNaN(parseInt(pageStr, 10)) ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr && !isNaN(parseInt(limitStr, 10)) ? parseInt(limitStr, 10) : undefined;
    return await this.licenciasService.listar(escuelaId, libroId, estado, page, limit);
  }

  /**
   * GET /licencias/escuela/:id
   * Admin o Director: licencias de una escuela.
   */
  @Get('escuela/:id')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Licencias de una escuela' })
  @ApiParam({ name: 'id', description: 'ID de la escuela' })
  @ApiQuery({ name: 'libroId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: ['disponible', 'usada', 'vencida'] })
  @ApiResponse({ status: 200, description: 'Licencias de la escuela' })
  async listarPorEscuela(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
    @Query('libroId') libroIdStr?: string,
    @Query('estado') estado?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    if (req.user?.tipoPersona === 'director' && req.user?.director) {
      const miEscuelaId = req.user.director.escuelaId;
      if (Number(miEscuelaId) !== Number(id)) {
        throw new ForbiddenException('Solo puedes ver las licencias de tu escuela.');
      }
    }
    const libroId = libroIdStr ? parseInt(libroIdStr, 10) : undefined;
    const page = pageStr && !isNaN(parseInt(pageStr, 10)) ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr && !isNaN(parseInt(limitStr, 10)) ? parseInt(limitStr, 10) : undefined;
    return await this.licenciasService.listarPorEscuela(id, libroId, estado, page, limit);
  }

  /**
   * GET /licencias/escuela/:id/totales
   * Admin o Director: totales de licencias por escuela y desglose por libro.
   */
  @Get('escuela/:id/totales')
  @UseGuards(AdminOrDirectorGuard)
  @ApiTags('Admin o Director')
  @ApiOperation({ summary: 'Totales de licencias por escuela (y por libro)' })
  @ApiParam({ name: 'id', description: 'ID de la escuela' })
  @ApiResponse({ status: 200, description: 'Totales por escuela' })
  @ApiResponse({ status: 403, description: 'No autorizado (director solo su escuela)' })
  async totalesPorEscuela(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: ReqUser },
  ) {
    if (req.user?.tipoPersona === 'director' && req.user?.director) {
      const miEscuelaId = req.user.director.escuelaId;
      if (Number(miEscuelaId) !== Number(id)) {
        throw new ForbiddenException('Solo puedes ver las licencias de tu escuela.');
      }
    }
    return await this.licenciasService.obtenerTotalesPorEscuela(id);
  }

  /**
   * GET /licencias/exportar-pdf
   * Admin: exporta lista filtrada de licencias a PDF.
   */
  @Get('exportar-pdf')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Exportar licencias a PDF' })
  @ApiQuery({ name: 'escuelaId', required: true, type: Number })
  @ApiQuery({ name: 'libroId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: ['disponible', 'usada', 'vencida'] })
  @ApiResponse({ status: 200, description: 'PDF de licencias' })
  async exportarPdf(
    @Query('escuelaId', ParseIntPipe) escuelaId: number,
    @Query('libroId') libroIdStr?: string,
    @Query('estado') estado?: string,
  ) {
    const estadoOk =
      estado == null ||
      ['disponible', 'usada', 'vencida'].includes(String(estado));
    if (!estadoOk) {
      throw new BadRequestException(
        'estado inválido. Usa: disponible | usada | vencida',
      );
    }

    const libroId = libroIdStr ? parseInt(libroIdStr, 10) : undefined;
    const buffer = await this.licenciasService.exportarLicenciasAPdf(
      escuelaId,
      libroId,
      estado,
    );

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename=licencias_${escuelaId}.pdf`,
    });
  }

  /**
   * POST /licencias/archivar-vencidas
   * Admin: mueve vencidas a tabla histórica y las elimina de la tabla activa.
   */
  @Post('archivar-vencidas')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Archivar licencias vencidas (no se muestran en listados)' })
  async archivarVencidas(@Body() dto: ArchivarVencidasDto) {
    return await this.licenciasService.archivarLicenciasVencidas(dto.escuelaId, dto.libroId);
  }

  /**
   * DELETE /licencias/:id
   * Admin: eliminar una licencia (solo si está disponible, no canjeada).
   * Se archiva para auditoría antes de borrar.
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Eliminar una licencia disponible (por error)' })
  @ApiParam({ name: 'id', description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Licencia eliminada correctamente' })
  @ApiResponse({ status: 400, description: 'La licencia ya fue canjeada' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async eliminarLicencia(@Param('id', ParseIntPipe) id: number) {
    return await this.licenciasService.eliminarLicencia(id);
  }

  /**
   * POST /licencias/eliminar-disponibles
   * Admin: eliminar licencias disponibles en lote.
   * Todos los campos opcionales: sin escuela → todas; sin libro → todos; sin cantidad → todas.
   */
  @Post('eliminar-disponibles')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary:
      'Eliminar licencias disponibles. Filtros opcionales: escuelaId, libroId, cantidad. Sin filtros = todas.',
  })
  @ApiResponse({ status: 200, description: 'Licencias eliminadas' })
  async eliminarDisponibles(@Body() dto: EliminarLicenciasDisponiblesDto) {
    return await this.licenciasService.eliminarLicenciasDisponibles(
      dto.escuelaId,
      dto.libroId,
      dto.cantidad,
    );
  }

  /**
   * POST /licencias/canjear
   * Alumno canjea su licencia con su token (solo clave en el body).
   */
  @Post('canjear')
  @UseGuards(AlumnoGuard)
  @ApiTags('Solo Alumno')
  @ApiOperation({ summary: 'Canjear licencia con clave (usa alumnoId del token)' })
  @ApiResponse({ status: 201, description: 'Licencia canjeada correctamente' })
  @ApiResponse({ status: 400, description: 'Licencia vencida, desactivada o escuela no coincide' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async canjear(@Body() dto: CanjearLicenciaDto, @Request() req: { user?: ReqUser }) {
    const alumnoId = req.user?.alumno?.id ?? 0;
    if (!alumnoId) {
      throw new ForbiddenException('No se encontró el alumno.');
    }
    return await this.licenciasService.canjear(
      dto.clave,
      alumnoId,
      'alumno',
      alumnoId,
      getAuditContext(req as any),
    );
  }

  /**
   * PATCH /licencias/:id/activa
   * Admin activa/desactiva licencia.
   */
  @Patch(':id/activa')
  @UseGuards(AdminGuard)
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Activar o desactivar licencia' })
  @ApiParam({ name: 'id', description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Licencia actualizada' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async setActiva(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { activa: boolean },
  ) {
    if (typeof body.activa !== 'boolean') {
      throw new ForbiddenException('El body debe incluir "activa" (boolean).');
    }
    return await this.licenciasService.setActiva(id, body.activa);
  }
}
