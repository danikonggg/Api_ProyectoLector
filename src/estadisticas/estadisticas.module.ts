import { Module } from '@nestjs/common';
import { EstadisticasProgresoService } from './estadisticas-progreso.service';

@Module({
  providers: [EstadisticasProgresoService],
  exports: [EstadisticasProgresoService],
})
export class EstadisticasModule {}
