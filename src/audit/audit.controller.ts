/**
 * ============================================
 * CONTROLADOR: AuditController
 * ============================================
 * Endpoints para consultar logs de auditoría.
 * Solo administradores pueden acceder.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit
   * Listar logs de auditoría (solo administradores)
   */
  @Get()
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Listar logs de auditoría (requiere admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs de auditoría',
    schema: {
      example: {
        message: 'Logs de auditoría obtenidos correctamente',
        total: 50,
        meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
        data: [
          {
            id: 1,
            accion: 'login',
            usuarioId: 1,
            ip: '192.168.1.1',
            detalles: 'admin@example.com',
            fecha: '2025-02-04T12:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return await this.auditService.findAll(pageNum, limitNum);
  }
}
