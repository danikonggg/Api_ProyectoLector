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
import { Escuela } from '../personas/entities/escuela.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escuela]),
  ],
  controllers: [EscuelasController],
  providers: [EscuelasService],
  exports: [EscuelasService], // Exportar para que otros módulos puedan usar el servicio
})
export class EscuelasModule {}
