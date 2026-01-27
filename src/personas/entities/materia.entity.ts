/**
 * ============================================
 * ENTIDAD: Materia
 * ============================================
 * Representa una materia/asignatura del sistema.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('Materia')
export class Materia {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion: string;

  @Column({ name: 'nivel', type: 'varchar', length: 50, nullable: true })
  nivel: string;
}
