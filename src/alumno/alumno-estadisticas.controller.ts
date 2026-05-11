import { Controller, ForbiddenException, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import { AlumnoEstadisticasService } from './alumno-estadisticas.service';

type ReqUser = {
  alumno?: { id: number };
};

@Controller('alumno/estadisticas')
@UseGuards(AlumnoGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Alumno')
export class AlumnoEstadisticasController {
  constructor(private readonly alumnoEstadisticasService: AlumnoEstadisticasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener estadísticas reales del alumno' })
  @ApiResponse({ status: 200, description: 'Estadísticas del alumno' })
  async get(@Request() req: { user?: ReqUser }) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');
    return await this.alumnoEstadisticasService.getEstadisticas(alumnoId);
  }
}

