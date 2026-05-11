import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenciasAlumno } from './entities/preferencias-alumno.entity';
import { SesionLectura } from './entities/sesion-lectura.entity';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';
import { AlumnoSegmentoEvaluacion } from '../escuelas/entities/alumno-segmento-evaluacion.entity';
import { Anotacion } from '../escuelas/entities/anotacion.entity';
import { AlumnoPreferenciasController } from './alumno-preferencias.controller';
import { AlumnoPreferenciasService } from './alumno-preferencias.service';
import { AlumnoEstadisticasController } from './alumno-estadisticas.controller';
import { AlumnoEstadisticasService } from './alumno-estadisticas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreferenciasAlumno,
      SesionLectura,
      AlumnoLibro,
      AlumnoSegmentoEvaluacion,
      Anotacion,
    ]),
  ],
  controllers: [AlumnoPreferenciasController, AlumnoEstadisticasController],
  providers: [AlumnoPreferenciasService, AlumnoEstadisticasService],
  exports: [AlumnoPreferenciasService, AlumnoEstadisticasService],
})
export class AlumnoModule {}

