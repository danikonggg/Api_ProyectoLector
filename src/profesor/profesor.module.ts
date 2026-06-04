import { Module } from '@nestjs/common';
import { ProfesorController } from './profesor.controller';
import { ProfesorService } from './profesor.service';
import { EstadisticasModule } from '../estadisticas/estadisticas.module';

@Module({
  imports: [EstadisticasModule],
  controllers: [ProfesorController],
  providers: [ProfesorService],
  exports: [ProfesorService],
})
export class ProfesorModule {}
