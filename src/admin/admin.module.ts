/**
 * ============================================
 * MÓDULO: AdminModule
 * ============================================
 * Dashboard y endpoints exclusivos para administradores.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Libro } from '../libros/entities/libro.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escuela, Alumno, Maestro, Libro]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
