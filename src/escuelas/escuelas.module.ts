/**
 * ============================================
 * MÓDULO: EscuelasModule
 * ============================================
 * 
 * Módulo que agrupa todo lo relacionado con la gestión de escuelas.
 * Incluye entidades, DTOs, servicio y controlador.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscuelasService } from './escuelas.service';
import { EscuelasController } from './escuelas.controller';
import { AlumnoAnotacionesController } from './alumno-anotaciones.controller';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Director } from '../personas/entities/director.entity';
import { EscuelaLibro } from './entities/escuela-libro.entity';
import { Libro } from '../libros/entities/libro.entity';
import { Segmento } from '../libros/entities/segmento.entity';
import { AlumnoLibro } from './entities/alumno-libro.entity';
import { MaestroGrupo } from './entities/maestro-grupo.entity';
import { Anotacion } from './entities/anotacion.entity';
import { PersonasModule } from '../personas/personas.module';
import { LicenciasModule } from '../licencias/licencias.module';

@Module({
  imports: [
    PersonasModule,
    LicenciasModule,
    TypeOrmModule.forFeature([
      Escuela,
      Alumno,
      Maestro,
      Director,
      EscuelaLibro,
      Libro,
      Segmento,
      AlumnoLibro,
      MaestroGrupo,
      Anotacion,
    ]),
  ],
  controllers: [EscuelasController, AlumnoAnotacionesController],
  providers: [EscuelasService],
  exports: [EscuelasService], // Exportar para que otros módulos puedan usar el servicio
})
export class EscuelasModule {}
