/**
 * ============================================
 * ENTIDAD: EscuelaLibro
 * ============================================
 * Asignación libro ↔ escuela ("vender" libro a la escuela).
 * La escuela ve solo los libros con código asignado a ella.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Escuela } from '../../personas/entities/escuela.entity';
import { Libro } from '../../libros/entities/libro.entity';

@Entity('Escuela_Libro')
export class EscuelaLibro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date | null;

  @ManyToOne(() => Escuela)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;

  @ManyToOne(() => Libro)
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;
}
