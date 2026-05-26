import { Module } from '@nestjs/common';
import { EscuelasService } from './escuelas.service';
import { EscuelasController } from './escuelas.controller';
import { AlumnoAnotacionesController } from './alumno-anotaciones.controller';
import { PersonasModule } from '../personas/personas.module';
import { LicenciasModule } from '../licencias/licencias.module';
import { LibrosCoreModule } from '../libros/libros-core.module';
import { EvaluacionModule } from '../evaluacion/evaluacion.module';
import { ListarLibrosAsignadosAlumnoUseCase } from './application/listar-libros-asignados-alumno.use-case';
import { DesasignarLibroAlumnoUseCase } from './application/desasignar-libro-alumno.use-case';
import { EstadisticasEscuelaService } from './services/estadisticas-escuela.service';
import { ConsultaEscuelaService } from './services/consulta-escuela.service';
import { AlumnoEvaluacionSegmentoService } from './services/alumno-evaluacion-segmento.service';
import { AlumnoAnotacionesProgresoService } from './services/alumno-anotaciones-progreso.service';
import { MisLibrosInteraccionesController } from './mis-libros-interacciones.controller';
import { AlumnoSesionesLecturaService } from './services/alumno-sesiones-lectura.service';

@Module({
  imports: [PersonasModule, LicenciasModule, LibrosCoreModule, EvaluacionModule],
  controllers: [EscuelasController, AlumnoAnotacionesController, MisLibrosInteraccionesController],
  providers: [
    EscuelasService,
    ListarLibrosAsignadosAlumnoUseCase,
    DesasignarLibroAlumnoUseCase,
    EstadisticasEscuelaService,
    ConsultaEscuelaService,
    AlumnoEvaluacionSegmentoService,
    AlumnoAnotacionesProgresoService,
    AlumnoSesionesLecturaService,
  ],
  exports: [EscuelasService],
})
export class EscuelasModule {}
