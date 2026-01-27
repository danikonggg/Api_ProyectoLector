/**
 * ============================================
 * ENTIDAD: Escuela
 * ============================================
 * 
 * Representa una escuela en el sistema.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { Alumno } from './alumno.entity';
import { Maestro } from './maestro.entity';
import { Director } from './director.entity';

@Entity('Escuela')
export class Escuela {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'nivel', type: 'varchar', length: 50 })
  nivel: string;

  @Column({ name: 'clave', type: 'varchar', length: 50, nullable: true })
  clave: string;

  @Column({ name: 'direccion', type: 'varchar', length: 200, nullable: true })
  direccion: string;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono: string;

  // Relación uno-a-muchos con Alumno
  @OneToMany(() => Alumno, (alumno) => alumno.escuela)
  alumnos: Alumno[];

  // Relación uno-a-muchos con Maestro
  @OneToMany(() => Maestro, (maestro) => maestro.escuela)
  maestros: Maestro[];

  // Relación uno-a-muchos con Director
  @OneToMany(() => Director, (director) => director.escuela)
  directores: Director[];
}
