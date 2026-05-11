/**
 * ============================================
 * MÓDULO: EscuelasModule
 * ============================================
 *
 * Módulo que agrupa todo lo relacionado con la gestión de escuelas.
 * Incluye entidades, DTOs, servicio y controlador.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscuelasService } from './escuelas.service';
import { EscuelasController } from './escuelas.controller';
import { AlumnoAnotacionesController } from './alumno-anotaciones.controller';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Director } from '../personas/entities/director.entity';
import { EscuelaLibro } from './entities/escuela-libro.entity';
import { Libro } from '../libros/entities/libro.entity';
import { Segmento } from '../libros/entities/segmento.entity';
import { AlumnoLibro } from './entities/alumno-libro.entity';
import { MaestroGrupo } from './entities/maestro-grupo.entity';
import { Anotacion } from './entities/anotacion.entity';
import { PersonasModule } from '../personas/personas.module';
import { LicenciasModule } from '../licencias/licencias.module';
import { LibrosCoreModule } from '../libros/libros-core.module';
import { ListarLibrosAsignadosAlumnoUseCase } from './application/listar-libros-asignados-alumno.use-case';
import { DesasignarLibroAlumnoUseCase } from './application/desasignar-libro-alumno.use-case';
import { LicenciaLibro } from '../licencias/entities/licencia-libro.entity';
import { AlumnoSegmentoEvaluacion } from './entities/alumno-segmento-evaluacion.entity';
import { EstadisticasEscuelaService } from './services/estadisticas-escuela.service';
import { ConsultaEscuelaService } from './services/consulta-escuela.service';
import { AlumnoEvaluacionSegmentoService } from './services/alumno-evaluacion-segmento.service';
import { AlumnoAnotacionesProgresoService } from './services/alumno-anotaciones-progreso.service';
import { MisLibrosInteraccionesController } from './mis-libros-interacciones.controller';
import { SesionLectura } from '../alumno/entities/sesion-lectura.entity';
import { AlumnoSesionesLecturaService } from './services/alumno-sesiones-lectura.service';

@Module({
  imports: [
    PersonasModule,
    LicenciasModule,
    LibrosCoreModule,
    TypeOrmModule.forFeature([
      Escuela,
      Alumno,
      Maestro,
      Director,
      EscuelaLibro,
      Libro,
      Segmento,
      AlumnoLibro,
      LicenciaLibro,
      MaestroGrupo,
      Anotacion,
      AlumnoSegmentoEvaluacion,
      SesionLectura,
    ]),
  ],
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
  exports: [EscuelasService], // Exportar para que otros módulos puedan usar el servicio
})
export class EscuelasModule {}
