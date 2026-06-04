import { Controller, Get, Patch, Param, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProgresoService } from './services/progreso.service';
import { InsigniasService } from './services/insignias.service';
import { MapaLecturaService } from './services/mapa-lectura.service';
import { AlumnoGuard } from '../auth/guards/alumno.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';

type AuthReq = Request & { user: RequestUser };

@ApiTags('Gamificación')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AlumnoGuard)
@Controller('gamificacion')
export class GamificacionController {
  constructor(
    private readonly progresoSvc: ProgresoService,
    private readonly insigniasSvc: InsigniasService,
    private readonly mapaLecturaSvc: MapaLecturaService,
  ) {}

  // ─── Progreso ─────────────────────────────────────────────────────────────

  @Get('progreso')
  @ApiOperation({ summary: 'Mi progreso general (puntos, nivel, racha)' })
  @ApiResponse({ status: 200, description: 'Progreso del alumno autenticado' })
  async getProgreso(@Request() req: AuthReq) {
    const alumnoId = req.user.alumno!.id;
    const data = await this.progresoSvc.obtenerProgreso(alumnoId);
    return { message: 'Progreso obtenido', data };
  }

  @Get('niveles')
  @ApiOperation({ summary: 'Catálogo de todos los niveles del lector' })
  async getNiveles(@Request() req: AuthReq) {
    const niveles = await this.progresoSvc['prisma'].nivelLector.findMany({
      orderBy: { nivel: 'asc' },
    });
    return { message: 'Niveles obtenidos', data: niveles };
  }

  // ─── Insignias ────────────────────────────────────────────────────────────

  @Get('insignias')
  @ApiOperation({ summary: 'Mis insignias (obtenidas y pendientes)' })
  async getInsignias(@Request() req: AuthReq) {
    const alumnoId = req.user.alumno!.id;
    const [data, noVistas] = await Promise.all([
      this.insigniasSvc.listarInsignias(alumnoId),
      this.insigniasSvc.contarNoVistas(alumnoId),
    ]);
    return {
      message: 'Insignias obtenidas',
      noVistas,
      total: data.length,
      obtenidas: data.filter((i) => i.obtenida).length,
      data,
    };
  }

  @Patch('insignias/marcar-vistas')
  @ApiOperation({ summary: 'Marcar insignias nuevas como vistas' })
  async marcarInsigniasVistas(@Request() req: AuthReq) {
    const alumnoId = req.user.alumno!.id;
    await this.insigniasSvc.marcarVistas(alumnoId);
    return { message: 'Insignias marcadas como vistas' };
  }

  // ─── Mapa de lectura ──────────────────────────────────────────────────────

  @Get('mapa')
  @ApiOperation({ summary: 'Mapa personal de lectura (todos los libros)' })
  async getMapaGeneral(@Request() req: AuthReq) {
    const alumnoId = req.user.alumno!.id;
    const data = await this.mapaLecturaSvc.obtenerMapaAlumno(alumnoId);
    return { message: 'Mapa de lectura obtenido', total: data.length, data };
  }

  @Get('mapa/:libroId')
  @ApiOperation({ summary: 'Mapa de lectura de un libro específico' })
  async getMapaLibro(
    @Request() req: AuthReq,
    @Param('libroId', ParseIntPipe) libroId: number,
  ) {
    const alumnoId = req.user.alumno!.id;
    const data = await this.mapaLecturaSvc.obtenerMapaLibro(alumnoId, libroId);
    return { message: 'Mapa del libro obtenido', data };
  }
}
