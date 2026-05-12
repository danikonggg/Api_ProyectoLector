import { Module } from '@nestjs/common';
import { LicenciasService } from './licencias.service';
import { LicenciasController } from './licencias.controller';
import { LicenciasAutoArchiverService } from './licencias-auto-archiver.service';
import { ListarLibrosDisponiblesUseCase } from './application/listar-libros-disponibles.use-case';

@Module({
  controllers: [LicenciasController],
  providers: [LicenciasService, LicenciasAutoArchiverService, ListarLibrosDisponiblesUseCase],
  exports: [LicenciasService],
})
export class LicenciasModule {}
