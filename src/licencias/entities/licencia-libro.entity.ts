/**
 * ============================================
 * ENTIDAD: LicenciaLibro
 * ============================================
 * Licencia individual por libro: 1 licencia = 1 alumno.
 * Clave única, vencimiento, asociada a escuela, un solo uso.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Libro } from '../../libros/entities/libro.entity';
import { Escuela } from '../../personas/entities/escuela.entity';
import { Alumno } from '../../personas/entities/alumno.entity';

@Entity('Licencia_Libro')
export class LicenciaLibro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'clave', type: 'varchar', length: 50, unique: true })
  clave: string;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'alumno_id', type: 'bigint', nullable: true })
  alumnoId: number | null;

  @Column({ name: 'fecha_vencimiento', type: 'date' })
  fechaVencimiento: Date;

  @Column({ name: 'activa', type: 'boolean', default: true })
  activa: boolean;

  @Column({ name: 'fecha_asignacion', type: 'timestamptz', nullable: true })
  fechaAsignacion: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Libro)
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;

  @ManyToOne(() => Escuela)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;

  @ManyToOne(() => Alumno, { nullable: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno | null;
}
