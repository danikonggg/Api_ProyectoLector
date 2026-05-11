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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import { EscuelasService } from './escuelas.service';
import { CrearAnotacionMisLibroDto } from './dto/crear-anotacion-mis-libro.dto';
import { CrearSesionLecturaDto } from './dto/crear-sesion-lectura.dto';
import { AlumnoSesionesLecturaService } from './services/alumno-sesiones-lectura.service';

type ReqUser = {
  alumno?: { id: number };
};

@Controller('escuelas/mis-libros')
@UseGuards(AlumnoGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Alumno')
export class MisLibrosInteraccionesController {
  constructor(
    private readonly escuelasService: EscuelasService,
    private readonly alumnoSesionesLecturaService: AlumnoSesionesLecturaService,
  ) {}

  @Get(':libroId/anotaciones')
  @ApiOperation({ summary: 'Obtener anotaciones del alumno para un libro' })
  @ApiParam({ name: 'libroId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Lista de anotaciones' })
  async getAnotaciones(
    @Request() req: { user?: ReqUser },
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');

    const r = await this.escuelasService.listarAnotacionesAlumnoPorLibro(alumnoId, libroId);
    return { data: r.data ?? [] };
  }

  @Post(':libroId/anotaciones')
  @ApiOperation({ summary: 'Crear una anotación' })
  @ApiParam({ name: 'libroId', type: 'number' })
  @ApiResponse({ status: 201, description: 'Anotación creada' })
  async postAnotacion(
    @Request() req: { user?: ReqUser },
    @Param('libroId', ParseIntPipe) libroId: number,
    @Body() dto: CrearAnotacionMisLibroDto,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');

    const r = await this.escuelasService.crearAnotacionAlumno(alumnoId, {
      libroId,
      ...dto,
    });

    return { data: r.data };
  }

  @Delete(':libroId/anotaciones/:anotacionId')
  @ApiOperation({ summary: 'Eliminar una anotación específica' })
  @ApiParam({ name: 'libroId', type: 'number' })
  @ApiParam({ name: 'anotacionId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Anotación eliminada' })
  async deleteAnotacion(
    @Request() req: { user?: ReqUser },
    @Param('libroId', ParseIntPipe) _libroId: number,
    @Param('anotacionId', ParseIntPipe) anotacionId: number,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');

    await this.escuelasService.eliminarAnotacionAlumno(alumnoId, anotacionId);
    return { message: 'Anotación eliminada correctamente' };
  }

  @Post(':libroId/sesiones')
  @ApiOperation({ summary: 'Registrar una sesión de lectura al salir del lector' })
  @ApiParam({ name: 'libroId', type: 'number' })
  @ApiResponse({ status: 201, description: 'Sesión registrada' })
  async postSesion(
    @Request() req: { user?: ReqUser },
    @Param('libroId', ParseIntPipe) libroId: number,
    @Body() dto: CrearSesionLecturaDto,
  ) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');
    return await this.alumnoSesionesLecturaService.registrarSesion(alumnoId, libroId, dto);
  }
}

