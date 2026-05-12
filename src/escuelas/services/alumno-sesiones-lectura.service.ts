import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenciasService } from '../../licencias/licencias.service';
import { CrearSesionLecturaDto } from '../dto/crear-sesion-lectura.dto';

@Injectable()
export class AlumnoSesionesLecturaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenciasService: LicenciasService,
  ) {}

  private async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) },
    });
    if (!existe) return false;
    return this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
  }

  async registrarSesion(alumnoId: number, libroId: number, dto: CrearSesionLecturaDto) {
    const permitido = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!permitido) throw new ForbiddenException('No tienes asignado este libro.');

    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      throw new BadRequestException('fechaInicio/fechaFin inválidas.');
    }
    if (fechaFin.getTime() < fechaInicio.getTime()) {
      throw new BadRequestException('fechaFin debe ser mayor o igual a fechaInicio.');
    }

    const guardada = await this.prisma.sesionLectura.create({
      data: {
        alumnoId: BigInt(alumnoId),
        libroId: BigInt(libroId),
        duracionSegundos: dto.duracionSegundos,
        segmentosLeidos: dto.segmentosLeidos,
        segmentoInicioId: dto.segmentoInicioId != null ? BigInt(dto.segmentoInicioId) : null,
        segmentoFinId: dto.segmentoFinId != null ? BigInt(dto.segmentoFinId) : null,
        fechaInicio,
        fechaFin,
      },
    });

    if (!guardada?.id) throw new NotFoundException('No se pudo registrar la sesión.');

    return {
      data: {
        id: guardada.id,
        libroId: Number(guardada.libroId),
        duracionSegundos: guardada.duracionSegundos,
        segmentosLeidos: guardada.segmentosLeidos,
        fechaInicio: guardada.fechaInicio,
        fechaFin: guardada.fechaFin,
      },
    };
  }
}
