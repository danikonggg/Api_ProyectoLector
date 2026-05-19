import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface Apoyo {
  tipo: string;
  contenido: string;
  palabras?: Array<{ palabra: string; definicion: string | null }>;
}

@Injectable()
export class ApoyosPedagogicosService {
  constructor(private readonly prisma: PrismaService) {}

  async getApoyos(
    _alumnoId: bigint,
    _libroId: bigint,
    segmentoId: bigint,
    numeroFallo: number,
  ): Promise<Apoyo[]> {
    const segmento = await this.prisma.segmento.findUnique({
      where: { id: segmentoId },
      select: { pistaContextual: true, resumen: true },
    });

    const apoyos: Apoyo[] = [];

    // Fallo 1: solo pista_contextual
    if (numeroFallo >= 1) {
      apoyos.push({
        tipo: 'pista',
        contenido:
          segmento?.pistaContextual ??
          'Relee el fragmento prestando atencion a la idea principal y los detalles importantes.',
      });
    }

    // Fallo 2: pista + glosario
    if (numeroFallo >= 2) {
      const seccionesGlosario = await this.prisma.seccionGlosario.findMany({
        where: { segmentoId },
        select: { palabra: true, definicion: true },
        take: 10,
      });

      if (seccionesGlosario.length > 0) {
        apoyos.push({
          tipo: 'glosario',
          contenido: 'Palabras clave del fragmento que pueden ayudarte a comprender mejor:',
          palabras: seccionesGlosario.map((s) => ({
            palabra: s.palabra,
            definicion: s.definicion,
          })),
        });
      }
    }

    // Fallo 3+: pista + glosario + resumen
    if (numeroFallo >= 3) {
      apoyos.push({
        tipo: 'resumen',
        contenido:
          segmento?.resumen ??
          'Este fragmento contiene informacion importante sobre el tema. Identifica las ideas principales antes de responder.',
      });
    }

    return apoyos;
  }
}
