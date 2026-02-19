/**
 * ============================================
 * ENTIDAD: Libro
 * ============================================
 * Libro cargado por admin. PDF → extracción texto → segmentos.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Materia } from '../../personas/entities/materia.entity';
import { Unidad } from './unidad.entity';

@Entity('Libro')
export class Libro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'titulo', type: 'varchar', length: 150 })
  titulo: string;

  @Column({ name: 'materia_id', type: 'bigint', nullable: true })
  materiaId: number | null;

  @Column({ name: 'codigo', type: 'varchar', length: 50 })
  codigo: string;

  @Column({ name: 'grado', type: 'bigint' })
  grado: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 50, default: 'procesando' })
  estado: string;

  /** Si está activo globalmente. Inactivo = no se ve en ninguna escuela ni se puede otorgar. */
  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'num_paginas', type: 'bigint', nullable: true })
  numPaginas: number | null;

  @Column({ name: 'ruta_pdf', type: 'varchar', length: 512, nullable: true })
  rutaPdf: string | null;

  @ManyToOne(() => Materia, { nullable: true })
  @JoinColumn({ name: 'materia_id' })
  materia: Materia | null;

  @OneToMany(() => Unidad, (u) => u.libro)
  unidades: Unidad[];
}
