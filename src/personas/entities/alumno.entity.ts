/**
 * ============================================
 * ENTIDAD: Alumno
 * ============================================
 * 
 * Representa a un estudiante/alumno del sistema.
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
import { Padre } from './padre.entity';

@Entity('Alumno')
export class Alumno {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'bigint' })
  personaId: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'padre_id', type: 'bigint', nullable: true })
  padreId: number;

  @Column({ name: 'grado', type: 'bigint' })
  grado: number;

  @Column({ name: 'grupo', type: 'varchar', length: 10, nullable: true })
  grupo: string;

  @Column({ name: 'ciclo_escolar', type: 'varchar', length: 20, nullable: true })
  cicloEscolar: string;

  // Relación uno-a-uno con Persona
  @OneToOne(() => Persona, (persona) => persona.alumno)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  // Relación muchos-a-uno con Escuela
  @ManyToOne(() => Escuela, (escuela) => escuela.alumnos)
  @JoinColumn({ name: 'escuela_id' })
  escuela: Escuela;

  // Relación muchos-a-uno con Padre
  @ManyToOne(() => Padre, (padre) => padre.alumnos, { nullable: true })
  @JoinColumn({ name: 'padre_id' })
  padre: Padre;
}
