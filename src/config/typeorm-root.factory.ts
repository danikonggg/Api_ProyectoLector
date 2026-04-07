import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { LoggerOptions } from 'typeorm';
import { TypeOrmLoggerService } from '../common/database/typeorm-logger.service';

const DEFAULT_POOL_MAX = 20;
const DEFAULT_POOL_IDLE_MS = 120_000;

export function createTypeOrmConfig(configService: ConfigService): TypeOrmModuleOptions {
  const databaseUrl = configService.get('DATABASE_URL');
  const ssl = databaseUrl ? { rejectUnauthorized: false } : undefined;

  const poolMax = Number(configService.get('DB_POOL_SIZE')) || DEFAULT_POOL_MAX;
  const idleTimeoutMillis =
    Number(configService.get('DB_POOL_IDLE_TIMEOUT_MS')) || DEFAULT_POOL_IDLE_MS;

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
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
      max: poolMax,
      idleTimeoutMillis,
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
}
