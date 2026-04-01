/**
 * ============================================
 * ENTIDAD: MaestroGrupo
 * ============================================
 * Asignación maestro ↔ grupo. Un maestro puede impartir clase a varios grupos.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Maestro } from '../../personas/entities/maestro.entity';
import { Grupo } from './grupo.entity';

@Entity('Maestro_Grupo')
@Unique(['maestroId', 'grupoId'])
export class MaestroGrupo {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'maestro_id', type: 'bigint' })
  maestroId: number;

  @Column({ name: 'grupo_id', type: 'bigint' })
  grupoId: number;

  @ManyToOne(() => Maestro, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'maestro_id' })
  maestro: Maestro;

  @ManyToOne(() => Grupo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_id' })
  grupo: Grupo;
}
