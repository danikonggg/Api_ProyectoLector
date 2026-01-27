/**
 * ============================================
 * ENTIDAD: AlumnoMaestro
 * ============================================
 * Tabla de asignación alumno–maestro por materia.
 * Un maestro gestiona a sus alumnos a través de esta relación.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Alumno } from './alumno.entity';
import { Maestro } from './maestro.entity';
import { Materia } from './materia.entity';

@Entity('Alumno_Maestro')
export class AlumnoMaestro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'maestro_id', type: 'bigint' })
  maestroId: number;

  @Column({ name: 'materia_id', type: 'bigint' })
  materiaId: number;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date | null;

  @ManyToOne(() => Alumno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;

  @ManyToOne(() => Maestro, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'maestro_id' })
  maestro: Maestro;

  @ManyToOne(() => Materia)
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;
}
