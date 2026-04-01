/**
 * ============================================
 * ENTIDAD: LicenciaLibroArchivada
 * ============================================
 * Histórico de licencias vencidas.
 * Se usa para auditoría: la licencia se mueve desde "Licencia_Libro"
 * a esta tabla y se elimina de la tabla activa.
 */

import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Licencia_Libro_Archivada')
export class LicenciaLibroArchivada {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'licencia_id', type: 'bigint' })
  licenciaId: number;

  @Column({ name: 'clave', type: 'varchar', length: 50 })
  clave: string;

  @Column({ name: 'libro_id', type: 'bigint' })
  libroId: number;

  @Column({ name: 'escuela_id', type: 'bigint' })
  escuelaId: number;

  @Column({ name: 'alumno_id', type: 'bigint', nullable: true })
  alumnoId: number | null;

  @Column({ name: 'fecha_vencimiento', type: 'date' })
  fechaVencimiento: Date;

  @Column({ name: 'activa', type: 'boolean' })
  activa: boolean;

  @Column({ name: 'fecha_asignacion', type: 'timestamptz', nullable: true })
  fechaAsignacion: Date | null;

  @Column({ name: 'archivada_en', type: 'timestamptz' })
  archivadaEn: Date;

  @Column({ name: 'motivo', type: 'varchar', length: 64 })
  motivo: string;
}

