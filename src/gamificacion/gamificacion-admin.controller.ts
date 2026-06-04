import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsigniasService } from './services/insignias.service';
import { ProgresoService } from './services/progreso.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Gamificación (Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/gamificacion')
export class GamificacionAdminController {
  constructor(
    private readonly insigniasSvc: InsigniasService,
    private readonly progresoSvc: ProgresoService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('insignias/catalogo')
  @ApiOperation({ summary: 'Catálogo completo de insignias del sistema' })
  async getCatalogo() {
    const data = await this.prisma.insignia.findMany({ orderBy: { categoria: 'asc' } });
    return { message: 'Catálogo de insignias', total: data.length, data };
  }

  @Get('alumnos/:alumnoId/progreso')
  @ApiOperation({ summary: 'Ver progreso de un alumno específico' })
  async getProgresoAlumno(@Param('alumnoId', ParseIntPipe) alumnoId: number) {
    const data = await this.progresoSvc.obtenerProgreso(alumnoId);
    return { message: 'Progreso del alumno', data };
  }

  @Get('alumnos/:alumnoId/insignias')
  @ApiOperation({ summary: 'Ver insignias de un alumno específico' })
  async getInsigniasAlumno(@Param('alumnoId', ParseIntPipe) alumnoId: number) {
    const data = await this.insigniasSvc.listarInsignias(alumnoId);
    return {
      message: 'Insignias del alumno',
      total: data.length,
      obtenidas: data.filter((i) => i.obtenida).length,
      data,
    };
  }

  @Get('ranking')
  @ApiOperation({ summary: 'Ranking global de alumnos por puntos' })
  async getRanking() {
    const data = await this.prisma.alumnoProgreso.findMany({
      orderBy: { puntosTotales: 'desc' },
      take: 50,
      include: {
        alumno: {
          include: {
            persona: {
              select: { nombre: true, apellidoPaterno: true },
            },
          },
        },
      },
    });

    return {
      message: 'Ranking global',
      data: data.map((d, i) => ({
        posicion: i + 1,
        alumnoId: Number(d.alumnoId),
        nombre: `${d.alumno.persona.nombre} ${d.alumno.persona.apellidoPaterno}`,
        puntosTotales: d.puntosTotales,
        nivelActual: d.nivelActual,
        rachaActual: d.rachaActual,
        librosCompletados: d.librosCompletados,
      })),
    };
  }
}
