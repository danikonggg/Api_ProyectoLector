import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { PersonasService } from '../personas/personas.service';
import { ActualizarUsuarioDto } from '../personas/dto/actualizar-usuario.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly personasService: PersonasService,
  ) {}

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

  /**
   * GET /admin/usuarios
   * Lista todos los usuarios del sistema con totales por rol al inicio.
   */
  @Get('usuarios')
  @ApiTags('Solo Administrador')
  @ApiOperation({
    summary: 'Listar todos los usuarios con totales por rol',
    description:
      'Devuelve la cantidad de usuarios por cada rol (administrador, director, maestro, alumno, padre) y la lista completa de usuarios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuarios con totales por rol',
    schema: {
      example: {
        message: 'Usuarios obtenidos correctamente',
        totalesPorRol: {
          administrador: 2,
          director: 5,
          maestro: 15,
          alumno: 120,
          padre: 80,
          total: 222,
        },
        total: 222,
        data: [
          {
            id: 1,
            nombre: 'Juan',
            apellido: 'Pérez',
            correo: 'admin@example.com',
            telefono: null,
            fechaNacimiento: '1990-05-15',
            tipoPersona: 'administrador',
            activo: true,
            rolId: 1,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async getUsuarios() {
    return await this.personasService.obtenerTodosUsuariosConTotales();
  }

  /**
   * PATCH /admin/usuarios/:id
   * Actualizar un usuario por ID (cualquier rol). No se puede cambiar el rol (tipoPersona).
   */
  @Patch('usuarios/:id')
  @ApiTags('Solo Administrador')
  @ApiParam({ name: 'id', description: 'ID de la persona (usuario)' })
  @ApiOperation({
    summary: 'Actualizar usuario por ID',
    description:
      'Actualiza nombre, apellido, correo, teléfono, fecha de nacimiento, género, contraseña o estado activo. El rol no se puede cambiar.',
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o correo ya en uso' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async actualizarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @Request() req: ExpressRequest & { user?: { id: number }; ip?: string },
  ) {
    return await this.personasService.actualizarUsuarioPorId(id, dto, {
      usuarioId: req.user?.id ?? null,
      ip: req.ip ?? null,
    });
  }

  /**
   * DELETE /admin/usuarios/:id
   * Eliminar un usuario por ID (cualquier rol).
   */
  @Delete('usuarios/:id')
  @ApiTags('Solo Administrador')
  @ApiParam({ name: 'id', description: 'ID de la persona (usuario)' })
  @ApiOperation({
    summary: 'Eliminar usuario por ID',
    description: 'Elimina el usuario del sistema (administrador, director, maestro, alumno o padre).',
  })
  @ApiResponse({ status: 200, description: 'Usuario eliminado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  async eliminarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: { id: number }; ip?: string },
  ) {
    return await this.personasService.eliminarUsuarioPorId(id, {
      usuarioId: req.user?.id ?? null,
      ip: req.ip ?? null,
    });
  }
}
