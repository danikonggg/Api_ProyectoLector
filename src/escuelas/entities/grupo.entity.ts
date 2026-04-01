/**
 * ============================================
 * ENTIDAD: Grupo
 * ============================================
 * Grupo escolar (ej. 1A, 2B). Creado y gestionado solo por el director de la escuela.
 * Usado para organizar alumnos por grado y sección.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Escuela } from '../../personas/entities/escuela.entity';

@Entity('Grupo')
@Index(['escuelaId', 'grado', 'nombre'], { unique: true })
export class Grupo {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  /** Grado escolar (1, 2, 3...) */
  @Column({ name: 'grado', type: 'bigint' })
  grado: number;

  /** Nombre del grupo/sección (ej. "A", "B", "1") */
  @Column({ name: 'nombre', type: 'varchar', length: 20 })
  nombre: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @ManyToOne(() => Escuela)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;
}
