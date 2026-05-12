import { Module } from '@nestjs/common';
import { MateriasService } from './materias.service';
import { MateriasController } from './materias.controller';

@Module({
  controllers: [MateriasController],
  providers: [MateriasService],
  exports: [MateriasService],
})
export class MateriasModule {}
