import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('glosario')
export class Glosario {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'palabra', type: 'varchar', length: 180, unique: true })
  palabra: string;

  @Column({ name: 'definicion', type: 'text', nullable: true })
  definicion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
