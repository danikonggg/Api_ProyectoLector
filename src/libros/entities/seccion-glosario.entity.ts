import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Segmento } from './segmento.entity';

@Entity('seccion_glosario')
@Unique('uq_seccion_glosario_segmento_palabra', ['segmentoId', 'palabra'])
export class SeccionGlosario {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'segmento_id', type: 'bigint' })
  segmentoId: number;

  @Column({ name: 'palabra', type: 'varchar', length: 180 })
  palabra: string;

  @Column({ name: 'definicion', type: 'text', nullable: true })
  definicion: string | null;

  @ManyToOne(() => Segmento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segmento_id' })
  segmento: Segmento;
}
