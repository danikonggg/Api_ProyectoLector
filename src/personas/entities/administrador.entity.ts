/**
 * ============================================
 * ENTIDAD: Administrador
 * ============================================
 * 
 * Representa a un usuario administrador del sistema.
 * Relacionado con Persona mediante relación uno-a-uno.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Persona } from './persona.entity';

@Entity('Admin')
export class Administrador {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'bigint' })
  personaId: number;

  @Column({ name: 'fecha_alta', type: 'date', nullable: true })
  fechaAlta: Date;

  // Relación uno-a-uno con Persona
  @OneToOne(() => Persona, (persona) => persona.administrador)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;
}
