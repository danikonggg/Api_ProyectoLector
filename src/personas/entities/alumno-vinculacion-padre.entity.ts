/**
 * ============================================
 * ENTIDAD: AlumnoVinculacionPadre
 * ============================================
 *
 * Código de un solo uso para vincular un padre/tutor con un alumno.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Alumno } from './alumno.entity';

@Entity('Alumno_Vinculacion_Padre')
@Index(['codigo'], { unique: true })
export class AlumnoVinculacionPadre {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @ManyToOne(() => Alumno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'codigo', type: 'varchar', length: 64, unique: true })
  codigo: string;

  @Column({ name: 'usado', type: 'boolean', default: false })
  usado: boolean;

  @Column({ name: 'usado_en', type: 'timestamp', nullable: true })
  usadoEn: Date | null;

  @Column({ name: 'expira_en', type: 'timestamp', nullable: true })
  expiraEn: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamp' })
  creadoEn: Date;
}

