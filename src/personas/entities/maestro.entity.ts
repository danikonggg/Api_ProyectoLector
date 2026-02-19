/**
 * ============================================
 * ENTIDAD: Maestro
 * ============================================
 * 
 * Representa a un maestro/profesor del sistema.
 * Relacionado con Persona y Escuela.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Persona } from './persona.entity';
import { Escuela } from './escuela.entity';

@Entity('Maestro')
export class Maestro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'bigint' })
  personaId: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'especialidad', type: 'varchar', length: 100, nullable: true })
  especialidad: string;

  @Column({ name: 'fecha_contratacion', type: 'date', nullable: true })
  fechaContratacion: Date;

  /** Si está activo en la escuela. Se pone en false cuando la escuela pasa a inactiva/suspendida. */
  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  // Relación uno-a-uno con Persona
  @OneToOne(() => Persona, (persona) => persona.maestro)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  // Relación muchos-a-uno con Escuela
  @ManyToOne(() => Escuela, (escuela) => escuela.maestros)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;
}
