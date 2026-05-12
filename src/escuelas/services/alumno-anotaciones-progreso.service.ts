import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearAnotacionDto } from '../dto/crear-anotacion.dto';
import { LicenciasService } from '../../licencias/licencias.service';

@Injectable()
export class AlumnoAnotacionesProgresoService {
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

  async crearAnotacionAlumno(alumnoId: number, dto: CrearAnotacionDto) {
    if (dto.offsetFin <= dto.offsetInicio) {
      throw new BadRequestException('offsetFin debe ser mayor a offsetInicio.');
    }

    const alumnoIdBig = BigInt(alumnoId);
    const [alumno, tieneLibro, segmento] = await Promise.all([
      this.prisma.alumno.findUnique({ where: { id: alumnoIdBig }, select: { id: true } }),
      this.libroAsignadoAlAlumno(alumnoId, dto.libroId),
      this.prisma.segmento.findUnique({
        where: { id: BigInt(dto.segmentoId) },
        select: { id: true, libroId: true, contenido: true },
      }),
    ]);

    if (!alumno) throw new NotFoundException('Alumno no encontrado.');
    if (!tieneLibro) throw new ForbiddenException('No tienes asignado este libro.');
    if (!segmento) throw new NotFoundException('Segmento no encontrado.');
    if (Number(segmento.libroId) !== Number(dto.libroId)) {
      throw new BadRequestException('El segmento no pertenece al libro enviado.');
    }

    const largo = (segmento.contenido || '').length;
    if (dto.offsetInicio < 0 || dto.offsetFin > largo) {
      throw new BadRequestException('Offsets fuera del rango del contenido del segmento.');
    }

    if (dto.tipo === 'highlight' && !dto.color) {
      throw new BadRequestException('Para tipo "highlight" debes enviar color.');
    }
    if (dto.tipo === 'comentario' && (!dto.comentario || dto.comentario.trim().length === 0)) {
      throw new BadRequestException('Para tipo "comentario" debes enviar comentario.');
    }

    const guardada = await this.prisma.anotacion.create({
      data: {
        alumnoId: alumnoIdBig,
        libroId: BigInt(dto.libroId),
        segmentoId: BigInt(dto.segmentoId),
        tipo: dto.tipo,
        textoSeleccionado: dto.textoSeleccionado,
        offsetInicio: dto.offsetInicio,
        offsetFin: dto.offsetFin,
        color: dto.tipo === 'highlight' ? (dto.color ?? null) : null,
        comentario: dto.tipo === 'comentario' ? (dto.comentario ?? '').trim() : null,
      },
    });

    return { message: 'Anotación guardada correctamente.', data: guardada };
  }

  async eliminarAnotacionAlumno(alumnoId: number, anotacionId: number) {
    const anotacion = await this.prisma.anotacion.findUnique({
      where: { id: BigInt(anotacionId) },
      select: { id: true, alumnoId: true },
    });
    if (!anotacion) throw new NotFoundException('Anotación no encontrada.');
    if (Number(anotacion.alumnoId) !== alumnoId) {
      throw new ForbiddenException('No puedes eliminar anotaciones de otro alumno.');
    }

    await this.prisma.anotacion.delete({ where: { id: BigInt(anotacionId) } });
    return { message: 'Anotación eliminada correctamente.', data: { id: anotacionId } };
  }

  async listarAnotacionesAlumnoPorLibro(alumnoId: number, libroId: number) {
    const tieneLibro = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!tieneLibro) throw new ForbiddenException('No tienes asignado este libro.');

    const data = await this.prisma.anotacion.findMany({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) },
      orderBy: { creadoEn: 'asc' },
    });

    return { message: 'Anotaciones obtenidas correctamente.', total: data.length, data };
  }

  async actualizarProgresoLibro(
    alumnoId: number,
    libroId: number,
    dto: { porcentaje?: number; ultimoSegmentoId?: number },
  ) {
    const permitido = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!permitido) throw new NotFoundException('No tienes asignado este libro.');

    const asignacion = await this.prisma.alumnoLibro.findFirst({
      where: { alumnoId: BigInt(alumnoId), libroId: BigInt(libroId) },
      include: { libro: true },
    });
    if (!asignacion) throw new NotFoundException('No tienes asignado este libro.');

    const updated = await this.prisma.alumnoLibro.update({
      where: { id: asignacion.id },
      data: {
        ...(dto.porcentaje !== undefined && {
          porcentaje: Math.max(0, Math.min(100, dto.porcentaje)),
        }),
        ...(dto.ultimoSegmentoId !== undefined && {
          ultimoSegmentoId: dto.ultimoSegmentoId != null ? BigInt(dto.ultimoSegmentoId) : null,
        }),
        ultimaLectura: new Date(),
      },
    });

    return {
      message: 'Progreso actualizado correctamente.',
      data: {
        alumnoLibroId: Number(updated.id),
        libroId,
        progreso: updated.porcentaje,
        ultimoSegmentoId: updated.ultimoSegmentoId != null ? Number(updated.ultimoSegmentoId) : null,
        ultimaLectura: updated.ultimaLectura,
      },
    };
  }
}
