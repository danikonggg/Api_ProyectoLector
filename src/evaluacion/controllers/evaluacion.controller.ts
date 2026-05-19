import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AlumnoGuard } from '../../auth/guards/alumno.guard';
import { DiagnosticoService } from '../services/diagnostico.service';
import { BancoPreguntasService } from '../services/banco-preguntas.service';
import { PerfilAprendizajeService } from '../services/perfil-aprendizaje.service';
import { ApoyosPedagogicosService } from '../services/apoyos-pedagogicos.service';
import { ResponderDiagnosticoDto } from '../dto/responder-diagnostico.dto';
import { ResponderEvaluacionDto } from '../dto/responder-evaluacion.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NivelPregunta } from '../../libros/preguntas-segmento.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

interface AuthRequest extends Request {
  user: {
    id: number;
    alumno?: { id: number };
    tipoPersona: string;
  };
}

@UseGuards(AlumnoGuard)
@Controller('evaluacion')
export class EvaluacionController {
  private static readonly UMBRAL_APROBACION = 70;
  private static readonly MAX_INTENTOS = 3;

  constructor(
    private readonly diagnosticoService: DiagnosticoService,
    private readonly bancoPreguntasService: BancoPreguntasService,
    private readonly perfilService: PerfilAprendizajeService,
    private readonly apoyosService: ApoyosPedagogicosService,
    private readonly prisma: PrismaService,
  ) {}

  // ──────────────────────────────────────────────
  // DIAGNOSTICO
  // ──────────────────────────────────────────────

  @Get('diagnostico/:libroId')
  async getDiagnostico(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const result = await this.diagnosticoService.getPreguntasDiagnostico(
      alumnoId,
      BigInt(libroId),
    );
    return { message: 'Diagnostico obtenido correctamente.', data: result };
  }

  @Post('diagnostico/:libroId')
  async responderDiagnostico(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Body() dto: ResponderDiagnosticoDto,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const result = await this.diagnosticoService.procesarDiagnostico(
      alumnoId,
      BigInt(libroId),
      dto.respuestas,
    );
    return { message: 'Diagnostico procesado correctamente.', data: result };
  }

  // ──────────────────────────────────────────────
  // EVALUACION DE SEGMENTO
  // ──────────────────────────────────────────────

  @Get(':libroId/segmento/:segmentoId')
  async getEvaluacion(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Param('segmentoId', ParseIntPipe) segmentoId: number,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    await this.validarAcceso(alumnoId, libroIdBig, segmentoIdBig);

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoId, libroIdBig);
    const nivel = perfil.nivelActual as NivelPregunta;

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    const intentosRestantes = Math.max(0, EvaluacionController.MAX_INTENTOS - intentosPrevios);

    const preguntas = await this.bancoPreguntasService.getSetPreguntas(
      alumnoId,
      libroIdBig,
      segmentoIdBig,
      nivel,
      intentosPrevios + 1,
    );

    return {
      message: 'Evaluacion del segmento obtenida correctamente.',
      data: {
        segmentoId,
        nivel,
        preguntas,
        umbralAprobacion: EvaluacionController.UMBRAL_APROBACION,
        intentosRestantes,
        tiempoMinimoSegundos: perfil.tiempoMinimoActual,
      },
    };
  }

  @Post(':libroId/segmento/:segmentoId')
  async responderEvaluacion(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Param('segmentoId', ParseIntPipe) segmentoId: number,
    @Body() dto: ResponderEvaluacionDto,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    await this.validarAcceso(alumnoId, libroIdBig, segmentoIdBig);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    if (intentosPrevios >= EvaluacionController.MAX_INTENTOS) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoId, libroIdBig);
    const nivel = perfil.nivelActual as NivelPregunta;
    const intento = intentosPrevios + 1;

    const { score, tiposError } = await this.bancoPreguntasService.validarRespuestas(
      dto.respuestas,
    );

    const aprobado = score >= EvaluacionController.UMBRAL_APROBACION;
    const puedeAvanzar = aprobado;
    const aprobadoPrimerIntento = aprobado && intento === 1;

    // Get apoyos if failed
    let apoyos: unknown[] = [];
    if (!aprobado) {
      apoyos = await this.apoyosService.getApoyos(alumnoId, libroIdBig, segmentoIdBig, intento);
    }

    // Calculate tiempo total
    const tiempoRespuestaMs = dto.respuestas.reduce((acc, r) => acc + (r.tiempoMs ?? 0), 0);

    // Save evaluation
    await this.prisma.alumnoSegmentoEvaluacion.create({
      data: {
        alumnoId,
        libroId: libroIdBig,
        segmentoId: segmentoIdBig,
        nivelPregunta: nivel,
        intento,
        preguntas: dto.respuestas.map((r) => ({ preguntaId: r.preguntaId })) as unknown as object,
        respuestas: dto.respuestas as unknown as object,
        score,
        aprobado,
        puedeAvanzar,
        apoyos: apoyos as unknown as object,
        tiempoRespuestaMs: tiempoRespuestaMs > 0 ? tiempoRespuestaMs : null,
        tiposError: tiposError as unknown as object,
      },
    });

    // Apply adaptive learning
    await this.perfilService.aplicarResultadoEvaluacion(
      alumnoId,
      libroIdBig,
      aprobadoPrimerIntento,
      score,
    );

    return {
      message: 'Evaluacion registrada correctamente.',
      data: {
        score,
        aprobado,
        puedeAvanzar,
        siguienteAccion: aprobado ? 'continuar' : 'refuerzo',
        apoyos,
        tiposError,
      },
    };
  }

  // ──────────────────────────────────────────────
  // ESTADO DE APRENDIZAJE
  // ──────────────────────────────────────────────

  @Get(':libroId/estado')
  async getEstado(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const libroIdBig = BigInt(libroId);

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoId, libroIdBig);

    const alumnoLibro = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId, libroId: libroIdBig },
      select: { porcentaje: true, ultimaLectura: true },
    });

    return {
      message: 'Estado de aprendizaje obtenido correctamente.',
      data: {
        perfil: {
          nivelActual: perfil.nivelActual,
          tiempoMinimoActual: perfil.tiempoMinimoActual,
          rachaPosiva: perfil.rachaPosiva,
          rachaNegativa: perfil.rachaNegativa,
          diagnosticoCompletado: perfil.diagnosticoCompletado,
        },
        progreso: {
          porcentaje: alumnoLibro?.porcentaje ?? 0,
          ultimaLectura: alumnoLibro?.ultimaLectura ?? null,
        },
      },
    };
  }

  // ──────────────────────────────────────────────
  // APOYOS PEDAGOGICOS
  // ──────────────────────────────────────────────

  @Get(':libroId/segmento/:segmentoId/apoyos')
  async getApoyos(
    @Param('libroId', ParseIntPipe) libroId: number,
    @Param('segmentoId', ParseIntPipe) segmentoId: number,
    @Request() req: AuthRequest,
  ) {
    const alumnoId = BigInt(req.user.alumno!.id);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    const apoyos = await this.apoyosService.getApoyos(
      alumnoId,
      libroIdBig,
      segmentoIdBig,
      Math.max(1, intentosPrevios),
    );

    return {
      message: 'Apoyos pedagogicos obtenidos correctamente.',
      data: { apoyos },
    };
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private async validarAcceso(
    alumnoId: bigint,
    libroId: bigint,
    segmentoId: bigint,
  ): Promise<void> {
    const alumnoLibro = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId, libroId },
    });
    if (!alumnoLibro) {
      throw new NotFoundException('No tienes asignado este libro.');
    }

    const segmento = await this.prisma.segmento.findUnique({
      where: { id: segmentoId },
      select: { libroId: true },
    });
    if (!segmento) {
      throw new NotFoundException('Segmento no encontrado.');
    }
    if (segmento.libroId !== libroId) {
      throw new BadRequestException('El segmento no pertenece al libro indicado.');
    }
  }
}
