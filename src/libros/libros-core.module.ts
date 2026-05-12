import { Module } from '@nestjs/common';
import { LibrosPdfService } from './libros-pdf.service';
import { LibrosPdfImagenesService } from './libros-pdf-imagenes.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { LibroProcesamientoService } from './libro-procesamiento.service';
import { LibroUploadValidationService } from './libro-upload-validation.service';
import { GroqModule } from '../groq/groq.module';
import { GlosarioSegmentoService } from './glosario-segmento.service';
import { PreguntasSegmentoService } from './preguntas-segmento.service';

/** Lógica de PDF/procesamiento sin HTTP: usada por API y por worker BullMQ. */
@Module({
  imports: [GroqModule],
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
  ],
})
export class LibrosCoreModule {}
