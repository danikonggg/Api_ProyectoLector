import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PersonasModule } from './personas/personas.module';
import { AuthModule } from './auth/auth.module';
import { EscuelasModule } from './escuelas/escuelas.module';
import { MaestrosModule } from './maestros/maestros.module';
import { LibrosModule } from './libros/libros.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DirectorModule } from './director/director.module';
import { MateriasModule } from './materias/materias.module';
import { LicenciasModule } from './licencias/licencias.module';
import { GroqModule } from './groq/groq.module';
import { AuditHttpInterceptor } from './audit/interceptors/audit-http.interceptor';
import { createTypeOrmConfig } from './config/typeorm-root.factory';
import { RedisModule } from './infra/redis/redis.module';
import { QueuesModule } from './queues/queues.module';
import { NoopQueuesModule } from './queues/noop-queues.module';
import { isRedisConfigured } from './config/redis-env';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { buildLoggerParams } from './config/pino-logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildLoggerParams(config),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: configService.get<number>('THROTTLE_LIMIT_PER_MIN', 2000),
          },
        ],
        getTracker: (req: Record<string, unknown>) => {
          const u = req['user'] as { id?: number } | undefined;
          if (u?.id != null) {
            return `user:${u.id}`;
          }
          const rawIp =
            (Array.isArray(req['ips']) && req['ips'][0]) ||
            (typeof req['ip'] === 'string' ? req['ip'] : '');
          return `ip:${rawIp || 'unknown'}`;
        },
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        createTypeOrmConfig(configService),
      inject: [ConfigService],
    }),

    RedisModule,
    ...(isRedisConfigured() ? [QueuesModule] : [NoopQueuesModule]),

    AuthModule,
    PersonasModule,
    EscuelasModule,
    MaestrosModule,
    LibrosModule,
    MateriasModule,
    AuditModule,
    AdminModule,
    DirectorModule,
    LicenciasModule,
    GroqModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditHttpInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes('*');
  }
}
