import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersonasModule } from './personas/personas.module';
import { AuthModule } from './auth/auth.module';
import { EscuelasModule } from './escuelas/escuelas.module';
import { MaestrosModule } from './maestros/maestros.module';
import { LibrosModule } from './libros/libros.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DirectorModule } from './director/director.module';
import { TypeOrmLoggerService } from './common/database/typeorm-logger.service';
import type { LoggerOptions } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        { ttl: 60000, limit: configService.get<number>('THROTTLE_LIMIT_PER_MIN', 2000) },
      ],
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        const ssl = databaseUrl ? { rejectUnauthorized: false } : undefined;

        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: (configService.get('NODE_ENV') === 'development'
            ? configService.get('DB_LOG_QUERIES', 'true') === 'true'
              ? ['query', 'error']
              : ['error']
            : false) as LoggerOptions,
          logger: new TypeOrmLoggerService(),
          maxQueryExecutionTime: 2000,
          ssl,
          extra: {
            max: configService.get<number>('DB_POOL_SIZE', 80),
            idleTimeoutMillis: 30000,
          },
        };

        if (databaseUrl && typeof databaseUrl === 'string') {
          return { ...baseConfig, url: databaseUrl };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_DATABASE', 'api_lector'),
        };
      },
      inject: [ConfigService],
    }),

    AuthModule,
    PersonasModule,
    EscuelasModule,
    MaestrosModule,
    LibrosModule,
    AuditModule,
    AdminModule,
    DirectorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
