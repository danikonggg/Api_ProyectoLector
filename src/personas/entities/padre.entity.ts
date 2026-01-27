/**
 * ============================================
 * ENTIDAD: Padre
 * ============================================
 * 
 * Representa a un padre/tutor de alumnos.
 * Relacionado con Persona mediante relación uno-a-uno.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Persona } from './persona.entity';
import { Alumno } from './alumno.entity';

@Entity('Padre')
export class Padre {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'bigint' })
  personaId: number;

  @Column({ name: 'parentesco', type: 'varchar', length: 50, nullable: true })
  parentesco: string;

  // Relación uno-a-uno con Persona
  @OneToOne(() => Persona, (persona) => persona.padre)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  // Relación uno-a-muchos con Alumno
  @OneToMany(() => Alumno, (alumno) => alumno.padre)
  alumnos: Alumno[];
}
