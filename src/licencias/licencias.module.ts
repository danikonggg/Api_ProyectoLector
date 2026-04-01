/**
 * ============================================
 * MÓDULO: LicenciasModule
 * ============================================
 * Licencias individuales por libro: 1 licencia = 1 alumno.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicenciasService } from './licencias.service';
import { LicenciasController } from './licencias.controller';
import { LicenciasAutoArchiverService } from './licencias-auto-archiver.service';
import { LicenciaLibro } from './entities/licencia-libro.entity';
import { LicenciaLibroArchivada } from './entities/licencia-libro-archivada.entity';
import { Libro } from '../libros/entities/libro.entity';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LicenciaLibro,
      LicenciaLibroArchivada,
      Libro,
      Escuela,
      Alumno,
      EscuelaLibro,
      AlumnoLibro,
    ]),
  ],
  controllers: [LicenciasController],
  providers: [LicenciasService, LicenciasAutoArchiverService],
  exports: [LicenciasService],
})
export class LicenciasModule {}
