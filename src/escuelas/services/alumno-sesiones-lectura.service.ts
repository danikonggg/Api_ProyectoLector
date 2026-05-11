import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlumnoLibro } from '../entities/alumno-libro.entity';
import { LicenciasService } from '../../licencias/licencias.service';
import { SesionLectura } from '../../alumno/entities/sesion-lectura.entity';
import { CrearSesionLecturaDto } from '../dto/crear-sesion-lectura.dto';

@Injectable()
export class AlumnoSesionesLecturaService {
  constructor(
    @InjectRepository(AlumnoLibro)
    private readonly alumnoLibroRepository: Repository<AlumnoLibro>,
    @InjectRepository(SesionLectura)
    private readonly sesionLecturaRepository: Repository<SesionLectura>,
    private readonly licenciasService: LicenciasService,
  ) {}

  private async libroAsignadoAlAlumno(alumnoId: number, libroId: number): Promise<boolean> {
    const existe = await this.alumnoLibroRepository.findOne({ where: { alumnoId, libroId } });
    if (!existe) return false;
    return this.licenciasService.accesoLibroActivoSegunLicencia(alumnoId, libroId);
  }

  async registrarSesion(alumnoId: number, libroId: number, dto: CrearSesionLecturaDto) {
    const permitido = await this.libroAsignadoAlAlumno(alumnoId, libroId);
    if (!permitido) {
      throw new ForbiddenException('No tienes asignado este libro.');
    }

    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      throw new BadRequestException('fechaInicio/fechaFin inválidas.');
    }
    if (fechaFin.getTime() < fechaInicio.getTime()) {
      throw new BadRequestException('fechaFin debe ser mayor o igual a fechaInicio.');
    }

    const sesion = this.sesionLecturaRepository.create({
      alumnoId,
      libroId,
      duracionSegundos: dto.duracionSegundos,
      segmentosLeidos: dto.segmentosLeidos,
      segmentoInicioId: dto.segmentoInicioId ?? null,
      segmentoFinId: dto.segmentoFinId ?? null,
      fechaInicio,
      fechaFin,
    });

    const guardada = await this.sesionLecturaRepository.save(sesion);
    if (!guardada?.id) {
      throw new NotFoundException('No se pudo registrar la sesión.');
    }

    return {
      data: {
        id: guardada.id,
        libroId: guardada.libroId,
        duracionSegundos: guardada.duracionSegundos,
        segmentosLeidos: guardada.segmentosLeidos,
        fechaInicio: guardada.fechaInicio,
        fechaFin: guardada.fechaFin,
      },
    };
  }
}

