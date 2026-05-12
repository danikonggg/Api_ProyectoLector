import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NivelPregunta, PreguntasSegmentoService } from '../../libros/preguntas-segmento.service';
import { LicenciasService } from '../../licencias/licencias.service';

@Injectable()
export class AlumnoEvaluacionSegmentoService {
  private static readonly UMBRAL_APROBACION = 70;
  private static readonly MAX_INTENTOS_EVALUACION = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly preguntasSegmentoService: PreguntasSegmentoService,
    private readonly licenciasService: LicenciasService,
  ) {}

  private async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) },
    });
    if (!existe) return false;
    return this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
  }

  private nivelPorProgreso(porcentaje: number): NivelPregunta {
    if (porcentaje < 34) return 'basico';
    if (porcentaje < 67) return 'intermedio';
    return 'avanzado';
  }

  private nivelInferidoParaAlumnoLibro(porcentaje: number): NivelPregunta {
    return this.nivelPorProgreso(Number(porcentaje ?? 0));
  }

  private siguienteNivelParaReintento(nivelActual: NivelPregunta): NivelPregunta {
    if (nivelActual === 'avanzado') return 'intermedio';
    if (nivelActual === 'intermedio') return 'basico';
    return 'basico';
  }

  private async obtenerPreguntasSegmentoNivel(segmentoId: number, nivel: NivelPregunta): Promise<string[]> {
    const desdeDb = await this.preguntasSegmentoService.getPreguntasDesdeDb(segmentoId, nivel);
    if (desdeDb.length > 0) return desdeDb;
    const generado = await this.preguntasSegmentoService.getPreguntas(segmentoId, nivel);
    return generado.preguntas ?? [];
  }

  private async obtenerAsignacionYSegmentoValidados(alumnoId: number, libroId: number, segmentoId: number) {
    const permitido = await this.libroAsignadoAlAlumno(alumnoId, libroId);
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

    return { asignacion, segmento };
  }

  async obtenerEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number, nivelSolicitado?: string) {
    const { asignacion } = await this.obtenerAsignacionYSegmentoValidados(alumnoId, libroId, segmentoId);
    const nivelBase = this.nivelInferidoParaAlumnoLibro(asignacion.porcentaje);
    const nivel = nivelSolicitado && PreguntasSegmentoService.esNivelValido(nivelSolicitado) ? nivelSolicitado : nivelBase;

    const preguntasTexto = await this.obtenerPreguntasSegmentoNivel(segmentoId, nivel);
    const preguntas = preguntasTexto.map((texto, index) => ({ preguntaId: `${segmentoId}-${nivel}-${index + 1}`, texto }));

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId), segmentoId: BigInt(segmentoId) },
    });
    const intentosRestantes = Math.max(0, AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION - intentosPrevios);

    return {
      message: 'Evaluacion del segmento obtenida correctamente.',
      data: { segmentoId, nivel, preguntas, umbralAprobacion: AlumnoEvaluacionSegmentoService.UMBRAL_APROBACION, intentosRestantes },
    };
  }

  async responderEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number, dto: { respuestas: Array<{ preguntaId: string; respuesta: string }>; nivel?: string }) {
    const { asignacion } = await this.obtenerAsignacionYSegmentoValidados(alumnoId, libroId, segmentoId);

    const alumnoIdBig = BigInt(alumnoId);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });
    if (intentosPrevios >= AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    const nivelBase = this.nivelInferidoParaAlumnoLibro(asignacion.porcentaje);
    const nivel = dto.nivel && PreguntasSegmentoService.esNivelValido(dto.nivel) ? dto.nivel : nivelBase;
    const preguntasTexto = await this.obtenerPreguntasSegmentoNivel(segmentoId, nivel);
    const preguntas = preguntasTexto.map((texto, index) => ({ preguntaId: `${segmentoId}-${nivel}-${index + 1}`, texto }));

    if (preguntas.length === 0) throw new BadRequestException('No hay preguntas disponibles para este segmento.');

    const respuestasValidas = (dto.respuestas || []).filter((r) => r && typeof r.respuesta === 'string' && r.respuesta.trim().length > 0);
    const score = Math.round((respuestasValidas.length / preguntas.length) * 100);
    const aprobado = score >= AlumnoEvaluacionSegmentoService.UMBRAL_APROBACION;
    const puedeAvanzar = aprobado;
    const apoyos = aprobado ? null : [{ tipo: 'pista', contenido: 'Relee el fragmento y responde con tus palabras: idea principal, un detalle clave y una relacion causa-efecto.' }];

    await this.prisma.alumnoSegmentoEvaluacion.create({
      data: {
        alumnoId: alumnoIdBig,
        libroId: libroIdBig,
        segmentoId: segmentoIdBig,
        nivelPregunta: nivel,
        intento: intentosPrevios + 1,
        preguntas: preguntas as any,
        respuestas: (dto.respuestas ?? []) as any,
        score,
        aprobado,
        puedeAvanzar,
        apoyos: apoyos as any,
      },
    });

    return {
      message: 'Evaluacion registrada correctamente.',
      data: { score, aprobado, puedeAvanzar, siguienteAccion: aprobado ? 'continuar' : 'refuerzo', apoyos: apoyos ?? [] },
    };
  }

  async crearReintentoEvaluacionSegmento(alumnoId: number, libroId: number, segmentoId: number) {
    const { asignacion } = await this.obtenerAsignacionYSegmentoValidados(alumnoId, libroId, segmentoId);

    const alumnoIdBig = BigInt(alumnoId);
    const libroIdBig = BigInt(libroId);
    const segmentoIdBig = BigInt(segmentoId);

    const intentosPrevios = await this.prisma.alumnoSegmentoEvaluacion.count({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
    });
    if (intentosPrevios >= AlumnoEvaluacionSegmentoService.MAX_INTENTOS_EVALUACION) {
      throw new BadRequestException('Ya agotaste los intentos de evaluacion para este segmento.');
    }

    const ultimoIntento = await this.prisma.alumnoSegmentoEvaluacion.findFirst({
      where: { alumnoId: alumnoIdBig, libroId: libroIdBig, segmentoId: segmentoIdBig },
      orderBy: { id: 'desc' },
    });

    const nivelBase = this.nivelInferidoParaAlumnoLibro(asignacion.porcentaje);
    const nivelAnterior = ultimoIntento?.nivelPregunta && PreguntasSegmentoService.esNivelValido(ultimoIntento.nivelPregunta) ? ultimoIntento.nivelPregunta : nivelBase;
    const nivel = this.siguienteNivelParaReintento(nivelAnterior);

    const preguntasTexto = await this.obtenerPreguntasSegmentoNivel(segmentoId, nivel);
    if (preguntasTexto.length === 0) throw new BadRequestException('No hay preguntas disponibles para generar reintento.');

    const desplazamiento = intentosPrevios % preguntasTexto.length;
    const preguntasRotadas = preguntasTexto.slice(desplazamiento).concat(preguntasTexto.slice(0, desplazamiento));
    const preguntas = preguntasRotadas.map((texto, index) => ({ preguntaId: `${segmentoId}-${nivel}-${index + 1}`, texto }));

    return { message: 'Reintento de evaluacion generado correctamente.', data: { nivel, preguntas, intento: intentosPrevios + 1 } };
  }
}
