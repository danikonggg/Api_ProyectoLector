import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../infra/redis/redis.module';
import { QueuesModule } from '../queues/queues.module';
import { LibrosImportProcessor } from '../queues/libros-import.processor';
import { LibrosCoreModule } from '../libros/libros-core.module';
import { AuditModule } from '../audit/audit.module';
import { buildLoggerParams } from '../config/pino-logger.config';

/**
 * Proceso worker: BullMQ consumers (sin HTTP).
 * Ejecutar: node dist/worker.main.js o npm run start:worker
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildLoggerParams(config, { http: false }),
    }),
    PrismaModule,
    RedisModule,
    QueuesModule,
    AuditModule,
    LibrosCoreModule,
  ],
  providers: [LibrosImportProcessor],
})
export class WorkerModule {}
