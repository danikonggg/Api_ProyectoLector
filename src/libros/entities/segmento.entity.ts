/**
 * ============================================
 * ENTIDAD: Segmento
 * ============================================
 * Fragmento de texto del libro (~100–200 palabras, 1 idea).
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Libro } from './libro.entity';
import { Unidad } from './unidad.entity';

@Entity('Segmento')
export class Segmento {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'unidad_id', type: 'bigint' })
  unidadId: number;

  @Column({ name: 'contenido', type: 'text' })
  contenido: string;

  @Column({ name: 'numero_pagina', type: 'bigint', nullable: true })
  numeroPagina: number | null;

  @Column({ name: 'orden', type: 'bigint', default: 1 })
  orden: number;

  @Column({ name: 'id_externo', type: 'varchar', length: 100 })
  idExterno: string;

  @ManyToOne(() => Libro, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;

  @ManyToOne(() => Unidad, (u) => u.segmentos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;
}
