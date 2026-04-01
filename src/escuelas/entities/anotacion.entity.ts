import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Alumno } from '../../personas/entities/alumno.entity';
import { Libro } from '../../libros/entities/libro.entity';
import { Segmento } from '../../libros/entities/segmento.entity';

@Entity('Anotacion')
export class Anotacion {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'alumno_id', type: 'bigint' })
  alumnoId: number;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'segmento_id', type: 'bigint' })
  segmentoId: number;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: 'highlight' | 'comentario';

  @Column({ name: 'texto_seleccionado', type: 'text' })
  textoSeleccionado: string;

  @Column({ name: 'offset_inicio', type: 'int' })
  offsetInicio: number;

  @Column({ name: 'offset_fin', type: 'int' })
  offsetFin: number;

  @Column({ name: 'color', type: 'varchar', length: 20, nullable: true })
  color: 'amarillo' | 'verde' | 'rosa' | 'azul' | null;

  @Column({ name: 'comentario', type: 'text', nullable: true })
  comentario: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @ManyToOne(() => Alumno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;

  @ManyToOne(() => Libro, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'libro_id' })
  libro: Libro;

  @ManyToOne(() => Segmento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segmento_id' })
  segmento: Segmento;
}
