import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Runs daily at 2 AM. Deletes audit logs older than AUDIT_RETENTION_DAYS (default: 90). */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeOldLogs(): Promise<void> {
    const retentionDays = this.config.get<number>('AUDIT_RETENTION_DAYS', 90);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { fecha: { lt: cutoff } },
      });

      if (result.count > 0) {
        this.logger.log(
          `Audit retention: eliminados ${result.count} registros anteriores a ${cutoff.toISOString()}`,
        );
      }
    } catch (err) {
      this.logger.error('Error durante la purga de audit logs:', err);
    }
  }
}
