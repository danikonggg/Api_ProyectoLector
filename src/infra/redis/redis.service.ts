import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../../queues/redis-connection.factory';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly enabled: boolean;
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    const host = this.config.get<string>('REDIS_HOST')?.trim();
    this.enabled = !!(url || host);

    if (!this.enabled) {
      this.logger.warn('Redis deshabilitado (sin REDIS_URL ni REDIS_HOST). JWT cache y colas no disponibles.');
      return;
    }

    const opts = redisConnectionOptions(this.config);
    this.client = new Redis({
      ...opts,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.client.on('error', (e) => this.logger.error(e?.message ?? e));
  }

  get raw(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (!this.client) return;
    await this.client.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  /**
   * Bloqueo distribuido: true si se obtuvo el lock (SET NX).
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return true;
    const r = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return r === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
