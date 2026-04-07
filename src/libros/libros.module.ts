/**
 * Módulo HTTP de libros. Lógica pesada en LibrosCoreModule (compartida con worker).
 */

import { Module } from '@nestjs/common';
import { LibrosService } from './libros.service';
import { LibrosController } from './libros.controller';
import { LibrosCoreModule } from './libros-core.module';
import { EscuelasModule } from '../escuelas/escuelas.module';

@Module({
  imports: [EscuelasModule, LibrosCoreModule],
  controllers: [LibrosController],
  providers: [LibrosService],
  exports: [LibrosService],
})
export class LibrosModule {}
