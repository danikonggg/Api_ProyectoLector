import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUNTOS } from '../constants/puntos.constants';

export type EventoProgreso =
  | 'segmento_leido'
  | 'evaluacion_aprobada'
  | 'evaluacion_perfecta'
  | 'libro_completado'
  | 'racha_dia'
  | 'nivel_avanzado';

@Injectable()
export class ProgresoService {
  private readonly logger = new Logger(ProgresoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suma puntos al alumno y actualiza su nivel si corresponde.
   * Retorna el progreso actualizado con flag de si subió de nivel.
   */
  async sumarPuntos(alumnoId: number, evento: EventoProgreso) {
    const puntosGanados = PUNTOS[evento.toUpperCase() as keyof typeof PUNTOS] ?? 0;
    if (puntosGanados === 0) return null;

    const progreso = await this.upsertProgreso(alumnoId);
    const nuevosPuntos = progreso.puntosTotales + puntosGanados;

    const nivelAnterior = progreso.nivelActual;
    const nuevoNivel = await this.calcularNivel(nuevosPuntos);

    const actualizado = await this.prisma.alumnoProgreso.update({
      where: { alumnoId: BigInt(alumnoId) },
      data: {
        puntosTotales: nuevosPuntos,
        nivelActual: nuevoNivel,
        ultimaActividad: new Date(),
        ...(evento === 'segmento_leido' && {
          segmentosLeidos: { increment: 1 },
        }),
        ...(evento === 'evaluacion_aprobada' || evento === 'evaluacion_perfecta'
          ? { evaluacionesOk: { increment: 1 } }
          : {}),
        ...(evento === 'libro_completado' && {
          librosCompletados: { increment: 1 },
        }),
      },
    });

    return {
      progreso: actualizado,
      puntosGanados,
      subioNivel: nuevoNivel > nivelAnterior,
      nivelAnterior,
      nivelNuevo: nuevoNivel,
    };
  }

  async actualizarRacha(alumnoId: number, aprobado: boolean) {
    const progreso = await this.upsertProgreso(alumnoId);

    const rachaActual = aprobado ? progreso.rachaActual + 1 : 0;
    const rachaMasLarga = Math.max(progreso.rachaMasLarga, rachaActual);

    return this.prisma.alumnoProgreso.update({
      where: { alumnoId: BigInt(alumnoId) },
      data: { rachaActual, rachaMasLarga },
    });
  }

  async obtenerProgreso(alumnoId: number) {
    const progreso = await this.upsertProgreso(alumnoId);
    const nivel = await this.prisma.nivelLector.findUnique({
      where: { nivel: progreso.nivelActual },
    });
    const nivelSiguiente = await this.prisma.nivelLector.findUnique({
      where: { nivel: progreso.nivelActual + 1 },
    });

    const puntosParaSiguienteNivel = nivelSiguiente
      ? nivelSiguiente.puntosMin - progreso.puntosTotales
      : 0;

    const porcentajeNivel = nivel
      ? Math.min(
          100,
          Math.round(
            ((progreso.puntosTotales - nivel.puntosMin) /
              (nivel.puntosMax - nivel.puntosMin + 1)) *
              100,
          ),
        )
      : 0;

    return {
      ...progreso,
      alumnoId: Number(progreso.alumnoId),
      nivel,
      nivelSiguiente,
      puntosParaSiguienteNivel,
      porcentajeNivel,
    };
  }

  private async upsertProgreso(alumnoId: number) {
    return this.prisma.alumnoProgreso.upsert({
      where: { alumnoId: BigInt(alumnoId) },
      create: { alumnoId: BigInt(alumnoId) },
      update: {},
    });
  }

  private async calcularNivel(puntos: number): Promise<number> {
    const nivel = await this.prisma.nivelLector.findFirst({
      where: { puntosMin: { lte: puntos }, puntosMax: { gte: puntos } },
      orderBy: { nivel: 'desc' },
    });
    // Si supera el máximo nivel definido, queda en el último
    if (!nivel) {
      const ultimo = await this.prisma.nivelLector.findFirst({
        orderBy: { nivel: 'desc' },
      });
      return ultimo?.nivel ?? 1;
    }
    return nivel.nivel;
  }
}
