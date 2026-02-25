/**
 * ============================================
 * ENTIDAD: AlumnoLibro
 * ============================================
 * Asignación libro por alumno + progreso de lectura.
 * Maestro o Director asigna; el alumno solo ve libros asignados.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Alumno } from '../../personas/entities/alumno.entity';
import { Libro } from '../../libros/entities/libro.entity';
import { Segmento } from '../../libros/entities/segmento.entity';

@Entity('Alumno_Libro')
export class AlumnoLibro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'porcentaje', type: 'int', default: 0 })
  porcentaje: number;

  @Column({ name: 'ultimo_segmento_id', type: 'bigint', nullable: true })
  ultimoSegmentoId: number | null;

  @Column({ name: 'ultima_lectura', type: 'timestamptz', nullable: true })
  ultimaLectura: Date | null;

  @Column({ name: 'fecha_asignacion', type: 'date' })
  fechaAsignacion: Date;

  @Column({ name: 'asignado_por_tipo', type: 'varchar', length: 20, default: 'maestro' })
  asignadoPorTipo: string;

  @Column({ name: 'asignado_por_id', type: 'bigint', nullable: true })
  asignadoPorId: number | null;

  @ManyToOne(() => Alumno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;

  @ManyToOne(() => Libro, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;

  @ManyToOne(() => Segmento, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ultimo_segmento_id' })
  ultimoSegmento: Segmento | null;
}
