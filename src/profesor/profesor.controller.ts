import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MaestroGuard } from '../auth/guards/maestro.guard';
import { ProfesorService } from './profesor.service';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@Controller('profesor')
@UseGuards(MaestroGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Profesor')
export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  @Get('grupos')
  @ApiOperation({ summary: 'Grupos asignados al profesor autenticado' })
  @ApiResponse({ status: 200, description: 'Grupos del profesor' })
  async grupos(@Request() req: { user?: RequestUser }) {
    const maestroId = req.user?.maestro?.id;
    if (!maestroId) throw new ForbiddenException('No se encontró el profesor.');
    return await this.profesorService.getGrupos(maestroId);
  }

  @Get('grupos/:grupoId/alumnos')
  @ApiOperation({ summary: 'Alumnos de un grupo con progreso real' })
  @ApiParam({ name: 'grupoId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Alumnos del grupo' })
  async alumnosPorGrupo(
    @Request() req: { user?: RequestUser },
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    const maestroId = req.user?.maestro?.id;
    if (!maestroId) throw new ForbiddenException('No se encontró el profesor.');
    return await this.profesorService.getAlumnosPorGrupo(maestroId, grupoId);
  }

  @Get('libros/:libroId/alumnos')
  @ApiOperation({ summary: 'Progreso de un libro con todos mis alumnos' })
  @ApiParam({ name: 'libroId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Progreso del libro por alumno' })
  async progresoLibro(
    @Request() req: { user?: RequestUser },
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    const maestroId = req.user?.maestro?.id;
    if (!maestroId) throw new ForbiddenException('No se encontró el profesor.');
    return await this.profesorService.getProgresoLibro(maestroId, libroId);
  }

  @Get('alumnos/:alumnoId/libros')
  @ApiOperation({ summary: 'Detalle libro por libro de un alumno de mis grupos' })
  @ApiParam({ name: 'alumnoId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Libros del alumno con progreso' })
  async detalleAlumnoLibros(
    @Request() req: { user?: RequestUser },
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    const maestroId = req.user?.maestro?.id;
    if (!maestroId) throw new ForbiddenException('No se encontró el profesor.');
    return await this.profesorService.getDetalleAlumnoLibros(maestroId, alumnoId);
  }

  @Get('alumnos/:alumnoId/evaluaciones')
  @ApiOperation({ summary: 'Detalle de evaluaciones de un alumno de mis grupos' })
  @ApiParam({ name: 'alumnoId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Evaluaciones del alumno agrupadas por libro' })
  async evaluacionesAlumno(
    @Request() req: { user?: RequestUser },
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    const maestroId = req.user?.maestro?.id;
    if (!maestroId) throw new ForbiddenException('No se encontró el profesor.');
    return await this.profesorService.getEvaluacionesAlumno(maestroId, alumnoId);
  }
}

