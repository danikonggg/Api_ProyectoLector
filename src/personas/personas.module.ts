/**
 * ============================================
 * MÓDULO: PersonasModule
 * ============================================
 * 
 * Módulo que agrupa todo lo relacionado con el registro de personas.
 * Incluye entidades, DTOs, servicio y controlador.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonasService } from './personas.service';
import { PersonasController } from './personas.controller';
import { CargaMasivaService } from './carga-masiva.service';
import { Persona } from './entities/persona.entity';
import { Administrador } from './entities/administrador.entity';
import { Padre } from './entities/padre.entity';
import { Alumno } from './entities/alumno.entity';
import { Maestro } from './entities/maestro.entity';
import { Director } from './entities/director.entity';
import { Escuela } from './entities/escuela.entity';
import { AlumnoMaestro } from './entities/alumno-maestro.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Persona,
      Administrador,
      Padre,
      Alumno,
      Maestro,
      Director,
      Escuela,
      AlumnoMaestro,
    ]),
  ],
  controllers: [PersonasController],
  providers: [PersonasService, CargaMasivaService],
  exports: [PersonasService, CargaMasivaService],
})
export class PersonasModule {}
