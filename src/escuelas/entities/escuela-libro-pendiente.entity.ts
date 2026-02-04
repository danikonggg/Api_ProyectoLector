/**
 * ============================================
 * ENTIDAD: EscuelaLibroPendiente
 * ============================================
 * Libro "otorgado" por el admin a una escuela, pendiente de que
 * la escuela lo canjee. Doble verificación: admin otorga → escuela canjea.
 * Solo cuando la escuela canjea se crea Escuela_Libro.
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

@Entity('Escuela_Libro_Pendiente')
export class EscuelaLibroPendiente {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'fecha_otorgado', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaOtorgado: Date;

  @ManyToOne(() => Escuela)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;

  @ManyToOne(() => Libro)
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;
}
