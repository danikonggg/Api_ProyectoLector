/**
 * ============================================
 * ENTIDAD: Persona
 * ============================================
 * 
 * Entidad principal que representa a cualquier persona en el sistema.
 * Todas las demás entidades (Administrador, Padre, Alumno, Maestro) 
 * están relacionadas con Persona mediante una relación uno-a-uno.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
} from 'typeorm';
import { Administrador } from './administrador.entity';
import { Padre } from './padre.entity';
import { Alumno } from './alumno.entity';
import { Maestro } from './maestro.entity';
import { Director } from './director.entity';

@Entity('Persona')
export class Persona {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'segundo_nombre', type: 'varchar', length: 100, nullable: true })
  segundoNombre: string | null;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 100 })
  apellidoPaterno: string;

  @Column({ name: 'apellido_materno', type: 'varchar', length: 100, nullable: true })
  apellidoMaterno: string | null;

  /** @deprecated Usar apellidoPaterno. Se mantiene por compatibilidad con columna legacy. */
  @Column({ name: 'apellido', type: 'varchar', length: 100, nullable: true })
  apellido: string | null;

  @Column({ name: 'correo', type: 'varchar', length: 150, nullable: true })
  correo: string;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ name: 'genero', type: 'varchar', length: 30, nullable: true })
  genero: string;

  // Campos adicionales para autenticación
  // NOTA: Estos campos deben agregarse a la base de datos ejecutando el script migrations/add_auth_fields.sql
  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true, select: false })
  password: string;

  @Column({ name: 'tipo_persona', type: 'varchar', length: 50, nullable: true })
  tipoPersona: string;

  @Column({ name: 'activo', type: 'boolean', default: true, nullable: true })
  activo: boolean;

  @Column({ name: 'ultima_conexion', type: 'timestamptz', nullable: true })
  ultimaConexion: Date;

  // Getters para compatibilidad con código existente
  get idPersona(): number {
    return this.id;
  }

  get email(): string {
    return this.correo;
  }

  set email(value: string) {
    this.correo = value;
  }

  // Relaciones uno-a-uno con los diferentes tipos de usuario
  @OneToOne(() => Administrador, (admin) => admin.persona)
  administrador?: Administrador;

  @OneToOne(() => Padre, (padre) => padre.persona)
  padre?: Padre;

  @OneToOne(() => Alumno, (alumno) => alumno.persona)
  alumno?: Alumno;

  @OneToOne(() => Maestro, (maestro) => maestro.persona)
  maestro?: Maestro;

  @OneToOne(() => Director, (director) => director.persona)
  director?: Director;
}
