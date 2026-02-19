/**
 * ============================================
 * ENTIDAD: Director
 * ============================================
 * 
 * Representa a un director/encargado de una escuela.
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

@Entity('Director')
export class Director {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'bigint' })
  personaId: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'fecha_nombramiento', type: 'date', nullable: true })
  fechaNombramiento: Date;

  /** Si está activo en la escuela. Se pone en false cuando la escuela pasa a inactiva/suspendida. */
  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  // Relación uno-a-uno con Persona
  @OneToOne(() => Persona, (persona) => persona.director)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  // Relación muchos-a-uno con Escuela
  @ManyToOne(() => Escuela, (escuela) => escuela.directores)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;
}
