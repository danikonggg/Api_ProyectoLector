/**
 * ============================================
 * MÓDULO: MaestrosModule
 * ============================================
 * Gestión de alumnos por maestros (listar, ver, asignar, desasignar).
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaestrosService } from './maestros.service';
import { MaestrosController } from './maestros.controller';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Materia } from '../personas/entities/materia.entity';
import { AlumnoMaestro } from '../personas/entities/alumno-maestro.entity';
import { EscuelasModule } from '../escuelas/escuelas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alumno, Maestro, Materia, AlumnoMaestro]),
    EscuelasModule,
  ],
  controllers: [MaestrosController],
  providers: [MaestrosService],
  exports: [MaestrosService],
})
export class MaestrosModule {}
