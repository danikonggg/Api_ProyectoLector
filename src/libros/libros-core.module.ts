import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibrosPdfService } from './libros-pdf.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { LibroProcesamientoService } from './libro-procesamiento.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { Libro } from './entities/libro.entity';
import { Unidad } from './entities/unidad.entity';
import { Segmento } from './entities/segmento.entity';
import { PreguntaSegmento } from './entities/pregunta-segmento.entity';
import { Glosario } from './entities/glosario.entity';
import { SeccionGlosario } from './entities/seccion-glosario.entity';
import { Materia } from '../personas/entities/materia.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';
import { EscuelaLibroPendiente } from '../escuelas/entities/escuela-libro-pendiente.entity';
import { GroqModule } from '../groq/groq.module';
import { GlosarioSegmentoService } from './glosario-segmento.service';
import { PreguntasSegmentoService } from './preguntas-segmento.service';

/** Lógica de PDF/procesamiento sin HTTP: usada por API y por worker BullMQ. */
@Module({
  imports: [
    GroqModule,
    TypeOrmModule.forFeature([
      Libro,
      Unidad,
      Segmento,
      PreguntaSegmento,
      Glosario,
      SeccionGlosario,
      Materia,
      EscuelaLibro,
      EscuelaLibroPendiente,
    ]),
  ],
  providers: [
    LibrosPdfService,
    LibrosPdfImagenesService,
    SupabaseStorageService,
    LibroProcesamientoService,
    LibroUploadValidationService,
    GlosarioSegmentoService,
    PreguntasSegmentoService,
  ],
  exports: [
    LibroProcesamientoService,
    GlosarioSegmentoService,
    PreguntasSegmentoService,
    SupabaseStorageService,
    LibrosPdfImagenesService,
    LibroUploadValidationService,
    TypeOrmModule,
  ],
})
export class LibrosCoreModule {}
