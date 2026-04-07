import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

/** Lógica de PDF/procesamiento sin HTTP: usada por API y por worker BullMQ. */
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
  providers: [
    LibrosPdfService,
    LibrosPdfImagenesService,
    PdfStorageService,
    LibroProcesamientoService,
    LibroUploadValidationService,
  ],
  exports: [
    LibroProcesamientoService,
    PdfStorageService,
    LibrosPdfImagenesService,
    LibroUploadValidationService,
    TypeOrmModule,
  ],
})
export class LibrosCoreModule {}
