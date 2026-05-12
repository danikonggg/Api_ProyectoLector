import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchPreferenciasDto } from './dto/patch-preferencias.dto';

@Injectable()
export class AlumnoPreferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(alumnoId: number) {
    return await this.prisma.preferenciasAlumno.upsert({
      where: { alumnoId: BigInt(alumnoId) },
      update: {},
      create: { alumnoId: BigInt(alumnoId) },
    });
  }

  async patch(alumnoId: number, dto: PatchPreferenciasDto) {
    const prefs = await this.getOrCreate(alumnoId);

    return await this.prisma.preferenciasAlumno.update({
      where: { id: prefs.id },
      data: {
        ...(dto.ocultarTutorialLector !== undefined && {
          ocultarTutorialLector: dto.ocultarTutorialLector,
        }),
        ...(dto.temaLector !== undefined && { temaLector: dto.temaLector }),
        ...(dto.idioma !== undefined && { idioma: dto.idioma }),
      },
    });
  }
}
