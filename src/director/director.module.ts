import { Module } from '@nestjs/common';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { EscuelasModule } from '../escuelas/escuelas.module';
import { PersonasModule } from '../personas/personas.module';
import { EstadisticasModule } from '../estadisticas/estadisticas.module';

@Module({
  imports: [EscuelasModule, PersonasModule, EstadisticasModule],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
