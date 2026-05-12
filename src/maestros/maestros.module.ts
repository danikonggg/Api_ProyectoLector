import { Module } from '@nestjs/common';
import { MaestrosService } from './maestros.service';
import { MaestrosController } from './maestros.controller';
import { EscuelasModule } from '../escuelas/escuelas.module';

@Module({
  imports: [EscuelasModule],
  controllers: [MaestrosController],
  providers: [MaestrosService],
  exports: [MaestrosService],
})
export class MaestrosModule {}
