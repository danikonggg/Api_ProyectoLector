import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('Sesion_Lectura')
@Index(['alumnoId', 'libroId'])
@Index(['fechaFin'])
export class SesionLectura {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'duracion_segundos', type: 'int' })
  duracionSegundos: number;

  @Column({ name: 'segmentos_leidos', type: 'int', default: 0 })
  segmentosLeidos: number;

  @Column({ name: 'segmento_inicio_id', type: 'bigint', nullable: true })
  segmentoInicioId: number | null;

  @Column({ name: 'segmento_fin_id', type: 'bigint', nullable: true })
  segmentoFinId: number | null;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'timestamptz' })
  fechaFin: Date;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}

