import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

export type TemaLector = 'sepia' | 'oscuro' | 'claro';

@Entity('Preferencias_Alumno')
@Index(['alumnoId'], { unique: true })
export class PreferenciasAlumno {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'ocultar_tutorial_lector', type: 'boolean', default: false })
  ocultarTutorialLector: boolean;

  @Column({ name: 'tema_lector', type: 'varchar', length: 10, default: 'sepia' })
  temaLector: TemaLector;

  @Column({ name: 'idioma', type: 'varchar', length: 5, default: 'es' })
  idioma: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}

