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
}

