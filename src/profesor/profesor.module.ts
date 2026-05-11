import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfesorController } from './profesor.controller';
import { ProfesorService } from './profesor.service';
import { MaestroGrupo } from '../escuelas/entities/maestro-grupo.entity';
import { Grupo } from '../escuelas/entities/grupo.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { AlumnoLibro } from '../escuelas/entities/alumno-libro.entity';
import { SesionLectura } from '../alumno/entities/sesion-lectura.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MaestroGrupo, Grupo, Alumno, AlumnoLibro, SesionLectura])],
  controllers: [ProfesorController],
  providers: [ProfesorService],
  exports: [ProfesorService],
})
export class ProfesorModule {}

