import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EscuelasService } from './escuelas.service';
import { CrearAnotacionDto } from './dto/crear-anotacion.dto';

type ReqUser = {
  alumno?: { id: number };
};

@Controller('alumno/anotaciones')
@UseGuards(JwtAuthGuard, AlumnoGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Alumno')
export class AlumnoAnotacionesController {
  constructor(private readonly escuelasService: EscuelasService) {}

  @Post()
  @ApiOperation({ summary: 'Guardar anotación (highlight/comentario)' })
  @ApiResponse({ status: 201, description: 'Anotación guardada.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 403, description: 'Libro no asignado al alumno.' })
  async crearAnotacion(
    @Request() req: { user?: ReqUser },
    @Body() dto: CrearAnotacionDto,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) {
      throw new ForbiddenException('No se encontró el alumno.');
    }
    return await this.escuelasService.crearAnotacionAlumno(alumnoId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar anotación' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID de la anotación' })
  @ApiResponse({ status: 200, description: 'Anotación eliminada.' })
  @ApiResponse({ status: 403, description: 'No puedes eliminar anotaciones de otro alumno.' })
  @ApiResponse({ status: 404, description: 'Anotación no encontrada.' })
  async eliminarAnotacion(
    @Request() req: { user?: ReqUser },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) {
      throw new ForbiddenException('No se encontró el alumno.');
    }
    return await this.escuelasService.eliminarAnotacionAlumno(alumnoId, id);
  }

  @Get(':libroId')
  @ApiOperation({ summary: 'Listar anotaciones del alumno por libro' })
  @ApiParam({ name: 'libroId', type: 'number', description: 'ID del libro' })
  @ApiResponse({ status: 200, description: 'Lista de anotaciones.' })
  async listarAnotacionesPorLibro(
    @Request() req: { user?: ReqUser },
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) {
      throw new ForbiddenException('No se encontró el alumno.');
    }
    return await this.escuelasService.listarAnotacionesAlumnoPorLibro(alumnoId, libroId);
  }
}
