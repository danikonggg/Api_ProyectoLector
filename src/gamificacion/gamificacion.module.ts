import { Module } from '@nestjs/common';
import { ProgresoService } from './services/progreso.service';
import { InsigniasService } from './services/insignias.service';
import { MapaLecturaService } from './services/mapa-lectura.service';
import { GamificacionEngineService } from './services/gamificacion-engine.service';
import { GamificacionController } from './gamificacion.controller';
import { GamificacionAdminController } from './gamificacion-admin.controller';

@Module({
  controllers: [GamificacionController, GamificacionAdminController],
  providers: [
    ProgresoService,
    InsigniasService,
    MapaLecturaService,
    GamificacionEngineService,
  ],
  exports: [GamificacionEngineService, ProgresoService, InsigniasService, MapaLecturaService],
})
export class GamificacionModule {}
