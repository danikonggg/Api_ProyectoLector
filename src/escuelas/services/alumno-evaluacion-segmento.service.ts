import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenciasService } from '../../licencias/licencias.service';
import { BancoPreguntasService } from '../../evaluacion/services/banco-preguntas.service';
import { PerfilAprendizajeService } from '../../evaluacion/services/perfil-aprendizaje.service';
import { NivelPregunta } from '../../libros/preguntas-segmento.service';

@Injectable()
export class AlumnoEvaluacionSegmentoService {
  private static readonly UMBRAL_APROBACION = 70;
  private static readonly MAX_INTENTOS_EVALUACION = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly licenciasService: LicenciasService,
    private readonly bancoPreguntasService: BancoPreguntasService,
    private readonly perfilService: PerfilAprendizajeService,
  ) {}

  private async validarAcceso(alumnoId: number, libroId: number, segmentoId: number) {
    const permitido = await this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
    if (!permitido) throw new NotFoundException('No tienes asignado este libro.');

    const alumnoIdBig = BigInt(alumnoId);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    const [asignacion, segmento] = await Promise.all([
      this.prisma.alumnoLibro.findFirst({ where: { alumnoId: alumnoIdBig, libroId: libroIdBig } }),
      this.prisma.segmento.findUnique({ where: { id: segmentoIdBig }, select: { id: true, libroId: true } }),
    ]);

    if (!asignacion) throw new NotFoundException('No tienes asignado este libro.');
    if (!segmento) throw new NotFoundException('Segmento no encontrado.');
    if (Number(segmento.libroId) !== libroId) throw new BadRequestException('El segmento no pertenece al libro enviado.');

    return { asignacion, alumnoIdBig, libroIdBig, segmentoIdBig };
  }

  /**
   * Devuelve las preguntas MCQ del segmento adaptadas al nivel del alumno.
   */
  async obtenerEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number) {
    const { alumnoIdBig, libroIdBig, segmentoIdBig } = await this.validarAcceso(alumnoId, libroId, segmentoId);

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoIdBig, libroIdBig);
    const nivel = perfil.nivelActual as NivelPregunta;

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    if (intentosPrevios >= AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    const preguntas = await this.bancoPreguntasService.getSetPreguntas(
      alumnoIdBig,
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
        umbralAprobacion: AlumnoEvaluacionSegmentoService.UMBRAL_APROBACION,
        intentosRestantes: AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION - intentosPrevios,
        tiempoMinimoSegundos: perfil.tiempoMinimoActual,
      },
    };
  }

  /**
   * Recibe respuestas A/B/C/D, calcula score real comparando contra BD,
   * actualiza el perfil adaptativo del alumno.
   */
  async responderEvaluacionSegmento(
    alumnoId: number,
    libroId: number,
    segmentoId: number,
    dto: { respuestas: Array<{ preguntaId: number; respuesta: string; tiempoMs?: number }> },
  ) {
    const { alumnoIdBig, libroIdBig, segmentoIdBig } = await this.validarAcceso(alumnoId, libroId, segmentoId);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    if (intentosPrevios >= AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    if (!dto.respuestas?.length) {
      throw new BadRequestException('Debes enviar al menos una respuesta.');
    }

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoIdBig, libroIdBig);
    const nivel = perfil.nivelActual as NivelPregunta;
    const intento = intentosPrevios + 1;

    // ✅ Score real: compara respuestas contra respuesta_correcta en BD
    const { score, tiposError } = await this.bancoPreguntasService.validarRespuestas(dto.respuestas);

    const aprobado = score >= AlumnoEvaluacionSegmentoService.UMBRAL_APROBACION;
    const aprobadoPrimerIntento = aprobado && intento === 1;
    const tiempoTotal = dto.respuestas.reduce((acc, r) => acc + (r.tiempoMs ?? 0), 0);

    const apoyos = aprobado
      ? []
      : [{ tipo: 'pista', contenido: 'Relee el fragmento con atención: identifica la idea principal, un detalle clave y una relación causa-efecto.' }];

    await this.prisma.alumnoSegmentoEvaluacion.create({
      data: {
        alumnoId: alumnoIdBig,
        libroId: libroIdBig,
        segmentoId: segmentoIdBig,
        nivelPregunta: nivel,
        intento,
        preguntas: dto.respuestas.map((r) => ({ preguntaId: r.preguntaId })) as unknown as object,
        respuestas: dto.respuestas as unknown as object,
        score,
        aprobado,
        puedeAvanzar: aprobado,
        apoyos: apoyos as unknown as object,
        tiempoRespuestaMs: tiempoTotal > 0 ? tiempoTotal : null,
        tiposError: tiposError as unknown as object,
      },
    });

    // ✅ Actualiza el perfil adaptativo (sube/baja nivel según rachas)
    await this.perfilService.aplicarResultadoEvaluacion(alumnoIdBig, libroIdBig, aprobadoPrimerIntento, score);

    return {
      message: 'Evaluacion registrada correctamente.',
      data: {
        score,
        aprobado,
        puedeAvanzar: aprobado,
        siguienteAccion: aprobado ? 'continuar' : 'refuerzo',
        apoyos,
        tiposError,
      },
    };
  }

  /**
   * Genera un reintento con preguntas rotadas y nivel ajustado.
   */
  async crearReintentoEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number) {
    const { alumnoIdBig, libroIdBig, segmentoIdBig } = await this.validarAcceso(alumnoId, libroId, segmentoId);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });

    if (intentosPrevios >= AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    const perfil = await this.perfilService.getOrCreatePerfil(alumnoIdBig, libroIdBig);
    const nivel = perfil.nivelActual as NivelPregunta;

    const preguntas = await this.bancoPreguntasService.getSetPreguntas(
      alumnoIdBig,
      libroIdBig,
      segmentoIdBig,
      nivel,
      intentosPrevios + 1,
    );

    if (preguntas.length === 0) {
      throw new BadRequestException('No hay preguntas disponibles para generar reintento.');
    }

    return {
      message: 'Reintento de evaluacion generado correctamente.',
      data: { nivel, preguntas, intento: intentosPrevios + 1 },
    };
  }
}
