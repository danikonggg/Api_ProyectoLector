import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from '../../personas/entities/alumno.entity';
import { Segmento } from '../../libros/entities/segmento.entity';
import { AlumnoLibro } from '../entities/alumno-libro.entity';
import { Anotacion } from '../entities/anotacion.entity';
import { CrearAnotacionDto } from '../dto/crear-anotacion.dto';
import { LicenciasService } from '../../licencias/licencias.service';

@Injectable()
export class AlumnoAnotacionesProgresoService {
  constructor(
    @InjectRepository(Alumno)
    private readonly alumnoRepository: Repository<Alumno>,
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectRepository(Anotacion)
    private readonly anotacionRepository: Repository<Anotacion>,
    private readonly licenciasService: LicenciasService,
  ) {}

  private async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
    });
    if (!existe) return false;
    return this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
  }

  async crearAnotacionAlumno(alumnoId: number, dto: CrearAnotacionDto) {
    if (dto.offsetFin <= dto.offsetInicio) {
      throw new BadRequestException('offsetFin debe ser mayor a offsetInicio.');
    }

    const [alumno, tieneLibro, segmento] = await Promise.all([
      this.alumnoRepository.findOne({ where: { id: alumnoId }, select: ['id'] }),
      this.libroAsignadoAlAlumno(alumnoId, dto.libroId),
      this.segmentoRepository.findOne({
        where: { id: dto.segmentoId },
        select: ['id', 'libroId', 'contenido'],
      }),
    ]);

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado.');
    }
    if (!tieneLibro) {
      throw new ForbiddenException('No tienes asignado este libro.');
    }
    if (!segmento) {
      throw new NotFoundException('Segmento no encontrado.');
    }
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

    const anotacion = this.anotacionRepository.create({
      alumnoId,
      libroId: dto.libroId,
      segmentoId: dto.segmentoId,
      tipo: dto.tipo,
      textoSeleccionado: dto.textoSeleccionado,
      offsetInicio: dto.offsetInicio,
      offsetFin: dto.offsetFin,
      color: dto.tipo === 'highlight' ? (dto.color ?? null) : null,
      comentario: dto.tipo === 'comentario' ? (dto.comentario ?? '').trim() : null,
    });
    const guardada = await this.anotacionRepository.save(anotacion);

    return {
      message: 'Anotación guardada correctamente.',
      data: guardada,
    };
  }

  async eliminarAnotacionAlumno(alumnoId: number, anotacionId: number) {
    const anotacion = await this.anotacionRepository.findOne({
      where: { id: anotacionId },
      select: ['id', 'alumnoId'],
    });
    if (!anotacion) {
      throw new NotFoundException('Anotación no encontrada.');
    }
    if (Number(anotacion.alumnoId) !== Number(alumnoId)) {
      throw new ForbiddenException('No puedes eliminar anotaciones de otro alumno.');
    }

    await this.anotacionRepository.delete({ id: anotacionId });
    return {
      message: 'Anotación eliminada correctamente.',
      data: { id: anotacionId },
    };
  }

  async listarAnotacionesAlumnoPorLibro(alumnoId: number, libroId: number) {
    const tieneLibro = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!tieneLibro) {
      throw new ForbiddenException('No tienes asignado este libro.');
    }

    const data = await this.anotacionRepository.find({
      where: { alumnoId, libroId },
      order: { creadoEn: 'ASC' },
    });

    return {
      message: 'Anotaciones obtenidas correctamente.',
      total: data.length,
      data,
    };
  }

  async actualizarProgresoLibro(
    alumnoId: number,
    libroId: number,
    dto: { porcentaje?: number; ultimoSegmentoId?: number },
  ) {
    const permitido = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!permitido) {
      throw new NotFoundException('No tienes asignado este libro.');
    }
    const asignacion = await this.alumnoLibroRepository.findOne({
      where: { alumnoId, libroId },
      relations: ['libro'],
    });
    if (!asignacion) {
      throw new NotFoundException('No tienes asignado este libro.');
    }

    if (dto.porcentaje !== undefined) {
      asignacion.porcentaje = Math.max(0, Math.min(100, dto.porcentaje));
    }
    if (dto.ultimoSegmentoId !== undefined) {
      asignacion.ultimoSegmentoId = dto.ultimoSegmentoId;
    }
    asignacion.ultimaLectura = new Date();
    await this.alumnoLibroRepository.save(asignacion);

    return {
      message: 'Progreso actualizado correctamente.',
      data: {
        alumnoLibroId: asignacion.id,
        libroId,
        progreso: asignacion.porcentaje,
        ultimoSegmentoId: asignacion.ultimoSegmentoId,
        ultimaLectura: asignacion.ultimaLectura,
      },
    };
  }
}
