import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenciasAlumno } from './entities/preferencias-alumno.entity';
import { PatchPreferenciasDto } from './dto/patch-preferencias.dto';

@Injectable()
export class AlumnoPreferenciasService {
  constructor(
    @InjectRepository(PreferenciasAlumno)
    private readonly preferenciasRepository: Repository<PreferenciasAlumno>,
  ) {}

  async getOrCreate(alumnoId: number) {
    const existente = await this.preferenciasRepository.findOne({ where: { alumnoId } });
    if (existente) return existente;

    const creada = this.preferenciasRepository.create({ alumnoId });
    return await this.preferenciasRepository.save(creada);
  }

  async patch(alumnoId: number, dto: PatchPreferenciasDto) {
    const prefs = await this.getOrCreate(alumnoId);

    if (dto.ocultarTutorialLector !== undefined) prefs.ocultarTutorialLector = dto.ocultarTutorialLector;
    if (dto.temaLector !== undefined) prefs.temaLector = dto.temaLector;
    if (dto.idioma !== undefined) prefs.idioma = dto.idioma;

    return await this.preferenciasRepository.save(prefs);
  }
}

