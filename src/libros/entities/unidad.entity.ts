/**
 * ============================================
 * ENTIDAD: Unidad
 * ============================================
 * Agrupación pedagógica de segmentos dentro de un libro.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Libro } from './libro.entity';
import { Segmento } from './segmento.entity';

@Entity('Unidad')
export class Unidad {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'orden', type: 'bigint', default: 1 })
  orden: number;

  @ManyToOne(() => Libro, (l) => l.unidades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;

  @OneToMany(() => Segmento, (s) => s.unidad)
  segmentos: Segmento[];
}
