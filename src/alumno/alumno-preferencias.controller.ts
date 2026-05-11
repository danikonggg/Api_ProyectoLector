import { Body, Controller, ForbiddenException, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import { PatchPreferenciasDto } from './dto/patch-preferencias.dto';
import { AlumnoPreferenciasService } from './alumno-preferencias.service';

type ReqUser = {
  alumno?: { id: number };
};

@Controller('alumno/preferencias')
@UseGuards(AlumnoGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Alumno')
export class AlumnoPreferenciasController {
  constructor(private readonly alumnoPreferenciasService: AlumnoPreferenciasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener preferencias del alumno' })
  @ApiResponse({ status: 200, description: 'Preferencias' })
  async get(@Request() req: { user?: ReqUser }) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');

    const prefs = await this.alumnoPreferenciasService.getOrCreate(alumnoId);
    return {
      data: {
        ocultarTutorialLector: prefs.ocultarTutorialLector,
        temaLector: prefs.temaLector,
        idioma: prefs.idioma,
      },
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar una o más preferencias del alumno' })
  @ApiResponse({ status: 200, description: 'Preferencias actualizadas' })
  async patch(@Request() req: { user?: ReqUser }, @Body() dto: PatchPreferenciasDto) {
    const alumnoId = req.user?.alumno?.id;
    if (!alumnoId) throw new ForbiddenException('No se encontró el alumno.');

    const prefs = await this.alumnoPreferenciasService.patch(alumnoId, dto);
    return {
      data: {
        ocultarTutorialLector: prefs.ocultarTutorialLector,
        temaLector: prefs.temaLector,
        idioma: prefs.idioma,
      },
    };
  }
}

