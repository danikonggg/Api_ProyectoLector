/**
 * ============================================
 * MÓDULO: LibrosModule
 * ============================================
 * Carga de libros: PDF → extracción → segmentación con unidades → BD.
 * Para procesamiento asíncrono con BullMQ, importar LibrosQueueModule.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibrosService } from './libros.service';
import { LibrosController } from './libros.controller';
import { LibrosPdfService } from './libros-pdf.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { PdfStorageService } from './pdf-storage.service';
import { LibroProcesamientoService } from './libro-procesamiento.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { PreguntaSegmento } from './entities/pregunta-segmento.entity';
import { Materia } from '../personas/entities/materia.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from '../escuelas/entities/escuela-libro-pendiente.entity';
import { EscuelasModule } from '../escuelas/escuelas.module';

@Module({
  imports: [
    EscuelasModule,
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
  providers: [
    LibrosService,
    LibrosPdfService,
    LibrosPdfImagenesService,
    PdfStorageService,
    LibroProcesamientoService,
    LibroUploadValidationService,
  ],
  exports: [LibrosService],
})
export class LibrosModule {}
