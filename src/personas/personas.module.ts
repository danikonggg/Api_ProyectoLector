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
import { AuthModule } from '../auth/auth.module';
import { PersonasController } from './personas.controller';
import { CargaMasivaService } from './carga-masiva.service';
import { VinculacionPadresService } from './services/vinculacion-padres.service';
import { RegistroPersonasService } from './services/registro-personas.service';
import { ConsultaPersonasService } from './services/consulta-personas.service';
import { GestionPersonasService } from './services/gestion-personas.service';
import { Persona } from './entities/persona.entity';
import { Administrador } from './entities/administrador.entity';
import { Padre } from './entities/padre.entity';
import { Alumno } from './entities/alumno.entity';
import { Maestro } from './entities/maestro.entity';
import { Director } from './entities/director.entity';
import { Escuela } from './entities/escuela.entity';
import { AlumnoMaestro } from './entities/alumno-maestro.entity';
import { Grupo } from '../escuelas/entities/grupo.entity';
import { AlumnoVinculacionPadre } from './entities/alumno-vinculacion-padre.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Persona,
      Administrador,
      Padre,
      Alumno,
      AlumnoVinculacionPadre,
      Maestro,
      Director,
      Escuela,
      AlumnoMaestro,
      Grupo,
    ]),
  ],
  controllers: [PersonasController],
  providers: [
    CargaMasivaService,
    VinculacionPadresService,
    RegistroPersonasService,
    ConsultaPersonasService,
    GestionPersonasService,
  ],
  exports: [
    CargaMasivaService,
    VinculacionPadresService,
    RegistroPersonasService,
    ConsultaPersonasService,
    GestionPersonasService,
  ],
})
export class PersonasModule {}
