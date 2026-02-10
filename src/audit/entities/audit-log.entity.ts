/**
 * ============================================
 * ENTIDAD: AuditLog
 * ============================================
 * Registro de acciones sensibles para auditoría.
 * Solo visible por administradores.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'accion', type: 'varchar', length: 80 })
  accion: string;

  @Column({ name: 'usuario_id', type: 'bigint', nullable: true })
  usuarioId: number | null;

  @Column({ name: 'ip', type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ name: 'detalles', type: 'text', nullable: true })
  detalles: string | null;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;
}
