import { ConfigService } from '@nestjs/config';

/** Opciones de conexión Redis para BullMQ e ioredis (misma URL/host). */
export function redisConnectionOptions(config: ConfigService): {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
} {
  const url = config.get<string>('REDIS_URL')?.trim();
  if (url) {
    return { url };
  }
  return {
    host: config.get<string>('REDIS_HOST', '127.0.0.1'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    db: config.get<number>('REDIS_DB', 0),
  };
}
