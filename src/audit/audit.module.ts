import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditRetentionService } from './audit-retention.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AuditController],
  providers: [AuditService, AuditRetentionService],
  exports: [AuditService],
})
export class AuditModule {}
