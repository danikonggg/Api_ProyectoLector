/**
 * ============================================
 * MÓDULO: LibrosModule
 * ============================================
 * Carga de libros (PDF → extracción → segmentos). Admin only.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibrosService } from './libros.service';
import { LibrosController } from './libros.controller';
import { LibrosPdfService } from './libros-pdf.service';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { Materia } from '../personas/entities/materia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Libro, Unidad, Segmento, Materia]),
  ],
  controllers: [LibrosController],
  providers: [LibrosService, LibrosPdfService],
  exports: [LibrosService],
})
export class LibrosModule {}
