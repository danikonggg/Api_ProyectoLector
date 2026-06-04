import { Injectable, Logger } from '@nestjs/common';
import { ProgresoService, EventoProgreso } from './progreso.service';
import { InsigniasService } from './insignias.service';
import { MapaLecturaService } from './mapa-lectura.service';

export interface ResultadoGamificacion {
  puntosGanados: number;
  subioNivel: boolean;
  nivelNuevo?: number;
  insigniasNuevas: string[];
  progresoActual: {
    puntosTotales: number;
    nivelActual: number;
    rachaActual: number;
    porcentajeNivel: number;
  };
}

/**
 * Punto de entrada único para toda la lógica de gamificación.
 * Los otros servicios (evaluación, escuelas) llaman a este.
 */
@Injectable()
export class GamificacionEngineService {
  private readonly logger = new Logger(GamificacionEngineService.name);

  constructor(
    private readonly progresoSvc: ProgresoService,
    private readonly insigniasSvc: InsigniasService,
    private readonly mapaLecturaSvc: MapaLecturaService,
  ) {}

  /** Llamar cuando el alumno lee un segmento */
  async onSegmentoLeido(
    alumnoId: number,
    libroId: number,
    segmentoId: number,
  ): Promise<ResultadoGamificacion> {
    const [resultPuntos] = await Promise.all([
      this.progresoSvc.sumarPuntos(alumnoId, 'segmento_leido'),
      this.mapaLecturaSvc.marcarSegmentoLeido(alumnoId, libroId, segmentoId),
    ]);

    const insigniasNuevas = await this.insigniasSvc.evaluarYOtorgar(alumnoId);
    const progreso = await this.progresoSvc.obtenerProgreso(alumnoId);

    return this.buildResultado(resultPuntos, insigniasNuevas, progreso);
  }

  /** Llamar cuando el alumno aprueba una evaluación de segmento */
  async onEvaluacionAprobada(
    alumnoId: number,
    aprobado: boolean,
    sinErrores: boolean,
  ): Promise<ResultadoGamificacion> {
    const evento: EventoProgreso = sinErrores ? 'evaluacion_perfecta' : 'evaluacion_aprobada';

    const [resultPuntos] = await Promise.all([
      aprobado ? this.progresoSvc.sumarPuntos(alumnoId, evento) : Promise.resolve(null),
      this.progresoSvc.actualizarRacha(alumnoId, aprobado),
    ]);

    if (aprobado && sinErrores) {
      await this.insigniasSvc.otorgarInsignia(alumnoId, 'evaluador_perfecto');
    }

    const insigniasNuevas = await this.insigniasSvc.evaluarYOtorgar(alumnoId);
    const progreso = await this.progresoSvc.obtenerProgreso(alumnoId);

    return this.buildResultado(resultPuntos, insigniasNuevas, progreso);
  }

  /** Llamar cuando el alumno completa un libro (porcentaje = 100) */
  async onLibroCompletado(alumnoId: number): Promise<ResultadoGamificacion> {
    const resultPuntos = await this.progresoSvc.sumarPuntos(alumnoId, 'libro_completado');
    const insigniasNuevas = await this.insigniasSvc.evaluarYOtorgar(alumnoId);
    const progreso = await this.progresoSvc.obtenerProgreso(alumnoId);

    return this.buildResultado(resultPuntos, insigniasNuevas, progreso);
  }

  private buildResultado(
    resultPuntos: Awaited<ReturnType<ProgresoService['sumarPuntos']>>,
    insigniasNuevas: string[],
    progreso: Awaited<ReturnType<ProgresoService['obtenerProgreso']>>,
  ): ResultadoGamificacion {
    return {
      puntosGanados: resultPuntos?.puntosGanados ?? 0,
      subioNivel: resultPuntos?.subioNivel ?? false,
      nivelNuevo: resultPuntos?.subioNivel ? resultPuntos.nivelNuevo : undefined,
      insigniasNuevas,
      progresoActual: {
        puntosTotales: progreso.puntosTotales,
        nivelActual: progreso.nivelActual,
        rachaActual: progreso.rachaActual,
        porcentajeNivel: progreso.porcentajeNivel,
      },
    };
  }
}
