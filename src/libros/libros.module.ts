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
import { PdfStorageService } from './pdf-storage.service';
import { PreguntasSegmentoService } from './preguntas-segmento.service';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { PreguntaSegmento } from './entities/pregunta-segmento.entity';
import { Materia } from '../personas/entities/materia.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from '../escuelas/entities/escuela-libro-pendiente.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Libro,
      Unidad,
      Segmento,
      PreguntaSegmento,
      Materia,
      EscuelaLibro,
      EscuelaLibroPendiente,
    ]),
  ],
  controllers: [LibrosController],
  providers: [LibrosService, LibrosPdfService, PdfStorageService, PreguntasSegmentoService],
  exports: [LibrosService],
})
export class LibrosModule {}
