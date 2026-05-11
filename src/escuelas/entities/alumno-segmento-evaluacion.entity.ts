import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('Alumno_Segmento_Evaluacion')
export class AlumnoSegmentoEvaluacion {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'segmento_id', type: 'bigint' })
  segmentoId: number;

  @Column({ name: 'nivel_pregunta', type: 'varchar', length: 20 })
  nivelPregunta: string;

  @Column({ name: 'intento', type: 'int', default: 1 })
  intento: number;

  @Column({ name: 'preguntas', type: 'jsonb' })
  preguntas: Array<{ preguntaId: string; texto: string }>;

  @Column({ name: 'respuestas', type: 'jsonb' })
  respuestas: Array<{ preguntaId: string; respuesta: string }>;

  @Column({ name: 'score', type: 'int', default: 0 })
  score: number;

  @Column({ name: 'aprobado', type: 'boolean', default: false })
  aprobado: boolean;

  @Column({ name: 'puede_avanzar', type: 'boolean', default: false })
  puedeAvanzar: boolean;

  @Column({ name: 'apoyos', type: 'jsonb', nullable: true })
  apoyos: Array<{ tipo: string; contenido?: string; palabras?: string[] }> | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
