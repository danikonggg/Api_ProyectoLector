import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LibrosCoreModule } from '../libros/libros-core.module';
import { EvaluacionController } from './controllers/evaluacion.controller';
import { PerfilAprendizajeService } from './services/perfil-aprendizaje.service';
import { BancoPreguntasService } from './services/banco-preguntas.service';
import { DiagnosticoService } from './services/diagnostico.service';
import { ApoyosPedagogicosService } from './services/apoyos-pedagogicos.service';

@Module({
  imports: [PrismaModule, LibrosCoreModule],
  controllers: [EvaluacionController],
  providers: [
    PerfilAprendizajeService,
    BancoPreguntasService,
    DiagnosticoService,
    ApoyosPedagogicosService,
  ],
  exports: [
    PerfilAprendizajeService,
    BancoPreguntasService,
    DiagnosticoService,
    ApoyosPedagogicosService,
  ],
})
export class EvaluacionModule {}
