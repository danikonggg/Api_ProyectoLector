import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MapaLecturaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un segmento como leído en el mapa del alumno.
   * Si no existe el mapa para ese libro, lo crea con todos los segmentos del libro.
   */
  async marcarSegmentoLeido(alumnoId: number, libroId: number, segmentoId: number) {
    const mapa = await this.obtenerOCrear(alumnoId, libroId);

    const completados = mapa.completados as number[];
    if (completados.includes(segmentoId)) return mapa;

    const nuevosCompletados = [...completados, segmentoId];
    const segmentosIds = mapa.segmentosIds as number[];
    const porcentaje =
      segmentosIds.length > 0
        ? Math.round((nuevosCompletados.length / segmentosIds.length) * 100)
        : 0;

    return this.prisma.mapaLectura.update({
      where: { alumnoId_libroId: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) } },
      data: {
        completados: nuevosCompletados,
        porcentaje,
        actualizadoEn: new Date(),
      },
    });
  }

  async obtenerMapaAlumno(alumnoId: number) {
    const mapas = await this.prisma.mapaLectura.findMany({
      where: { alumnoId: BigInt(alumnoId) },
      include: {
        libro: { select: { id: true, titulo: true, grado: true } },
      },
      orderBy: { actualizadoEn: 'desc' },
    });

    return mapas.map((m) => ({
      libroId: Number(m.libroId),
      titulo: m.libro.titulo,
      grado: Number(m.libro.grado),
      totalSegmentos: (m.segmentosIds as number[]).length,
      completados: (m.completados as number[]).length,
      porcentaje: m.porcentaje,
      actualizadoEn: m.actualizadoEn,
    }));
  }

  async obtenerMapaLibro(alumnoId: number, libroId: number) {
    const mapa = await this.obtenerOCrear(alumnoId, libroId);
    const segmentosIds = mapa.segmentosIds as number[];
    const completados = mapa.completados as number[];

    return {
      libroId,
      totalSegmentos: segmentosIds.length,
      segmentosIds,
      completados,
      porcentaje: mapa.porcentaje,
      actualizadoEn: mapa.actualizadoEn,
    };
  }

  private async obtenerOCrear(alumnoId: number, libroId: number) {
    const existente = await this.prisma.mapaLectura.findUnique({
      where: { alumnoId_libroId: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) } },
    });
    if (existente) return existente;

    // Crear mapa con todos los segmentos del libro
    const segmentos = await this.prisma.segmento.findMany({
      where: { libroId: BigInt(libroId) },
      select: { id: true },
      orderBy: { orden: 'asc' },
    });

    const segmentosIds = segmentos.map((s) => Number(s.id));

    return this.prisma.mapaLectura.create({
      data: {
        alumnoId: BigInt(alumnoId),
        libroId: BigInt(libroId),
        segmentosIds,
        completados: [],
        porcentaje: 0,
      },
    });
  }
}
