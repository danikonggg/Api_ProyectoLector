/**
 * ============================================
 * ENTIDAD: PreguntaSegmento
 * ============================================
 * Preguntas generadas por IA por nivel (básico, intermedio, avanzado)
 * para cada segmento. Se crean al cargar el libro.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Segmento } from './segmento.entity';

@Entity('PreguntaSegmento')
export class PreguntaSegmento {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'segmento_id', type: 'bigint' })
  segmentoId: number;

  @Column({ name: 'nivel', type: 'varchar', length: 20 })
  nivel: string;

  @Column({ name: 'texto_pregunta', type: 'text' })
  textoPregunta: string;

  @Column({ name: 'orden', type: 'int', default: 1 })
  orden: number;

  @ManyToOne(() => Segmento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segmento_id' })
  segmento: Segmento;
}
