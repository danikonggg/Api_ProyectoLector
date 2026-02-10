/**
 * ============================================
 * CONTROLADOR: AdminController
 * ============================================
 * Endpoints exclusivos para administradores.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/dashboard
   * Estadísticas del dashboard: escuelas activas, estudiantes, profesores, libros disponibles.
   */
  @Get('dashboard')
  @ApiTags('Solo Administrador')
  @ApiOperation({ summary: 'Dashboard admin: escuelas, estudiantes, profesores, libros' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas del dashboard',
    schema: {
      example: {
        message: 'Dashboard obtenido correctamente',
        data: {
          escuelasActivas: 5,
          totalEstudiantes: 120,
          totalProfesores: 15,
          librosDisponibles: 8,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async getDashboard() {
    return await this.adminService.getDashboard();
  }
}
