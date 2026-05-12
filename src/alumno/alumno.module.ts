import { Module } from '@nestjs/common';
import { AlumnoPreferenciasController } from './alumno-preferencias.controller';
import { AlumnoPreferenciasService } from './alumno-preferencias.service';
import { AlumnoEstadisticasController } from './alumno-estadisticas.controller';
import { AlumnoEstadisticasService } from './alumno-estadisticas.service';

@Module({
  controllers: [AlumnoPreferenciasController, AlumnoEstadisticasController],
  providers: [AlumnoPreferenciasService, AlumnoEstadisticasService],
  exports: [AlumnoPreferenciasService, AlumnoEstadisticasService],
})
export class AlumnoModule {}
