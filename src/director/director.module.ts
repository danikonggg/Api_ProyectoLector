import { Module } from '@nestjs/common';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { EscuelasModule } from '../escuelas/escuelas.module';
import { PersonasModule } from '../personas/personas.module';

@Module({
  imports: [EscuelasModule, PersonasModule],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
