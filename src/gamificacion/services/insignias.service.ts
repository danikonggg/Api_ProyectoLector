import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REGLAS_INSIGNIA } from '../constants/puntos.constants';

export type ClaveInsignia =
  | 'primer_libro'
  | 'racha_3'
  | 'racha_7'
  | 'evaluador_perfecto'
  | 'explorador'
  | 'anotador'
  | 'subrayador'
  | 'nivel_2' | 'nivel_3' | 'nivel_4' | 'nivel_5' | 'nivel_6'
  | 'velocista'
  | 'constante'
  | 'completista';

@Injectable()
export class InsigniasService {
  private readonly logger = new Logger(InsigniasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evalúa qué insignias debe recibir el alumno y las otorga.
   * Retorna las insignias nuevas obtenidas en esta evaluación.
   */
  async evaluarYOtorgar(alumnoId: number): Promise<ClaveInsignia[]> {
    const [progreso, yaObtenidas, countAnotaciones, countSubrayados, librosDistintos] =
      await Promise.all([
        this.prisma.alumnoProgreso.findUnique({ where: { alumnoId: BigInt(alumnoId) } }),
        this.prisma.alumnoInsignia.findMany({
          where: { alumnoId: BigInt(alumnoId) },
          select: { insignia: { select: { clave: true } } },
        }),
        this.prisma.anotacion.count({
          where: { alumnoId: BigInt(alumnoId), tipo: 'note' },
        }),
        this.prisma.anotacion.count({
          where: { alumnoId: BigInt(alumnoId), tipo: 'highlight' },
        }),
        this.prisma.alumnoLibro.findMany({
          where: { alumnoId: BigInt(alumnoId) },
          select: { libroId: true },
          distinct: ['libroId'],
        }),
      ]);

    const clavesPrevias = new Set(yaObtenidas.map((i) => i.insignia.clave));
    const candidatas: ClaveInsignia[] = [];

    if (progreso) {
      if (progreso.librosCompletados >= 1) candidatas.push('primer_libro');
      if (progreso.librosCompletados >= 1) candidatas.push('completista');
      if (progreso.rachaActual >= REGLAS_INSIGNIA.RACHA_3_DIAS) candidatas.push('racha_3');
      if (progreso.rachaActual >= REGLAS_INSIGNIA.RACHA_7_DIAS) candidatas.push('racha_7');
      if (progreso.nivelActual >= 2) candidatas.push('nivel_2');
      if (progreso.nivelActual >= 3) candidatas.push('nivel_3');
      if (progreso.nivelActual >= 4) candidatas.push('nivel_4');
      if (progreso.nivelActual >= 5) candidatas.push('nivel_5');
      if (progreso.nivelActual >= 6) candidatas.push('nivel_6');
    }

    if (countAnotaciones >= REGLAS_INSIGNIA.ANOTACIONES_PARA_INSIGNIA) candidatas.push('anotador');
    if (countSubrayados >= REGLAS_INSIGNIA.SUBRAYADOS_PARA_INSIGNIA) candidatas.push('subrayador');
    if (librosDistintos.length >= REGLAS_INSIGNIA.LIBROS_EXPLORADOR) candidatas.push('explorador');

    // Solo las que no tiene aún
    const nuevas = candidatas.filter((c) => !clavesPrevias.has(c));
    if (nuevas.length === 0) return [];

    const insignias = await this.prisma.insignia.findMany({
      where: { clave: { in: nuevas }, activa: true },
      select: { id: true, clave: true },
    });

    if (insignias.length > 0) {
      await this.prisma.alumnoInsignia.createMany({
        data: insignias.map((i) => ({
          alumnoId: BigInt(alumnoId),
          insigniaId: i.id,
        })),
        skipDuplicates: true,
      });
      this.logger.log(`Alumno ${alumnoId} obtuvo insignias: ${nuevas.join(', ')}`);
    }

    return nuevas;
  }

  /** Otorga una insignia puntual (ej. evaluador_perfecto, velocista) */
  async otorgarInsignia(alumnoId: number, clave: ClaveInsignia): Promise<boolean> {
    const insignia = await this.prisma.insignia.findUnique({
      where: { clave },
      select: { id: true },
    });
    if (!insignia) return false;

    try {
      await this.prisma.alumnoInsignia.create({
        data: { alumnoId: BigInt(alumnoId), insigniaId: insignia.id },
      });
      return true;
    } catch {
      return false; // ya la tenía (unique constraint)
    }
  }

  async listarInsignias(alumnoId: number) {
    const [todas, obtenidas] = await Promise.all([
      this.prisma.insignia.findMany({ where: { activa: true }, orderBy: { categoria: 'asc' } }),
      this.prisma.alumnoInsignia.findMany({
        where: { alumnoId: BigInt(alumnoId) },
        include: { insignia: true },
        orderBy: { obtenidaEn: 'desc' },
      }),
    ]);

    const obtenidosMap = new Map(obtenidas.map((o) => [o.insignia.clave, o]));

    return todas.map((ins) => {
      const obtenida = obtenidosMap.get(ins.clave);
      return {
        ...ins,
        id: Number(ins.id),
        obtenida: !!obtenida,
        obtenidaEn: obtenida?.obtenidaEn ?? null,
        visto: obtenida?.visto ?? false,
      };
    });
  }

  async marcarVistas(alumnoId: number) {
    await this.prisma.alumnoInsignia.updateMany({
      where: { alumnoId: BigInt(alumnoId), visto: false },
      data: { visto: true },
    });
  }

  async contarNoVistas(alumnoId: number): Promise<number> {
    return this.prisma.alumnoInsignia.count({
      where: { alumnoId: BigInt(alumnoId), visto: false },
    });
  }
}
