/**
 * Módulo de Materias.
 * CRUD de materias para Alumno_Maestro, Libros, etc.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Materia } from '../personas/entities/materia.entity';
import { MateriasService } from './materias.service';
import { MateriasController } from './materias.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Materia])],
  controllers: [MateriasController],
  providers: [MateriasService],
  exports: [MateriasService],
})
export class MateriasModule {}
