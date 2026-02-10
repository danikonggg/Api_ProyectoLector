/**
 * ============================================
 * SERVICIO: AuditService
 * ============================================
 * Registra acciones sensibles para auditoría.
 * Los logs solo son visibles por administradores.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
  detalles?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Registra una acción en el log de auditoría
   */
  async log(accion: string, context?: AuditContext): Promise<void> {
    try {
      const entry = this.auditRepository.create({
        accion,
        usuarioId: context?.usuarioId ?? null,
        ip: context?.ip ?? null,
        detalles: context?.detalles ?? null,
      });
      await this.auditRepository.save(entry);
    } catch (e) {
      this.logger.error(`Error al registrar auditoría: ${accion}`, e);
    }
  }

  /**
   * Obtiene los logs de auditoría con paginación (solo admin)
   */
  async findAll(page?: number, limit?: number) {
    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.fecha', 'DESC');

    const total = await qb.getCount();

    if (page != null && limit != null && page >= 1 && limit >= 1) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const data = await qb.getMany();

    const meta =
      page != null && limit != null
        ? { page, limit, total, totalPages: Math.ceil(total / limit) }
        : undefined;

    return {
      message: 'Logs de auditoría obtenidos correctamente',
      description: `Se encontraron ${data.length} registro(s)`,
      total,
      ...(meta && { meta }),
      data,
    };
  }
}
