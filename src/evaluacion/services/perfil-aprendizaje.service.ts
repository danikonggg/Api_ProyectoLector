import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PerfilAprendizajeService {
  static readonly DELTA_TIEMPO_SUBIDA = -20;
  static readonly DELTA_TIEMPO_BAJADA = 30;
  static readonly TIEMPO_MIN_BASE: Record<string, number> = {
    basico: 360,
    intermedio: 270,
    avanzado: 180,
  };
  static readonly TIEMPO_MIN_LIMITE = 60;
  static readonly TIEMPO_MAX_LIMITE = 600;
  static readonly RACHA_PARA_SUBIR = 3;
  static readonly RACHA_PARA_BAJAR = 2;

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePerfil(alumnoId: bigint, libroId: bigint) {
    const existente = await this.prisma.alumnoPerfilAprendizaje.findUnique({
      where: { alumnoId_libroId: { alumnoId, libroId } },
    });

    if (existente) return existente;

    return this.prisma.alumnoPerfilAprendizaje.create({
      data: {
        alumnoId,
        libroId,
        nivelActual: 'basico',
        tiempoMinimoActual: PerfilAprendizajeService.TIEMPO_MIN_BASE['basico'],
        rachaPosiva: 0,
        rachaNegativa: 0,
        diagnosticoCompletado: false,
      },
    });
  }

  async getPerfil(alumnoId: bigint, libroId: bigint) {
    return this.prisma.alumnoPerfilAprendizaje.findUnique({
      where: { alumnoId_libroId: { alumnoId, libroId } },
    });
  }

  async aplicarResultadoEvaluacion(
    alumnoId: bigint,
    libroId: bigint,
    aprobadoPrimerIntento: boolean,
    score: number,
  ) {
    const perfil = await this.getOrCreatePerfil(alumnoId, libroId);

    let { nivelActual, tiempoMinimoActual, rachaPosiva, rachaNegativa } = perfil;

    if (aprobadoPrimerIntento && score >= 80) {
      rachaPosiva += 1;
      rachaNegativa = 0;

      if (rachaPosiva >= PerfilAprendizajeService.RACHA_PARA_SUBIR) {
        nivelActual = this.subirNivel(nivelActual);
        tiempoMinimoActual = Math.max(
          PerfilAprendizajeService.TIEMPO_MIN_LIMITE,
          tiempoMinimoActual + PerfilAprendizajeService.DELTA_TIEMPO_SUBIDA,
        );
        rachaPosiva = 0;
      }
    } else {
      rachaNegativa += 1;
      rachaPosiva = 0;

      if (rachaNegativa >= PerfilAprendizajeService.RACHA_PARA_BAJAR) {
        nivelActual = this.bajarNivel(nivelActual);
        tiempoMinimoActual = Math.min(
          PerfilAprendizajeService.TIEMPO_MAX_LIMITE,
          tiempoMinimoActual + PerfilAprendizajeService.DELTA_TIEMPO_BAJADA,
        );
        rachaNegativa = 0;
      }
    }

    return this.prisma.alumnoPerfilAprendizaje.update({
      where: { alumnoId_libroId: { alumnoId, libroId } },
      data: {
        nivelActual,
        tiempoMinimoActual,
        rachaPosiva,
        rachaNegativa,
      },
    });
  }

  private subirNivel(nivel: string): string {
    if (nivel === 'basico') return 'intermedio';
    if (nivel === 'intermedio') return 'avanzado';
    return 'avanzado';
  }

  private bajarNivel(nivel: string): string {
    if (nivel === 'avanzado') return 'intermedio';
    if (nivel === 'intermedio') return 'basico';
    return 'basico';
  }
}
