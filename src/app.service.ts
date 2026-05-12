import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './infra/redis/redis.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  getHello(): string {
    return '¡Bienvenido a la API, TEAM VL!';
  }

  async getHealth(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    checks: {
      database: 'up' | 'down';
      redis: 'up' | 'down' | 'skipped';
      memory?: { heapUsed: number; heapTotal: number };
    };
  }> {
    let dbStatus: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      // DB no disponible
    }

    let redisStatus: 'up' | 'down' | 'skipped' = 'skipped';
    if (this.redisService.enabled) {
      redisStatus = (await this.redisService.ping()) ? 'up' : 'down';
    }

    const mem = process.memoryUsage();
    const dbOk = dbStatus === 'up';
    const redisOk = redisStatus === 'skipped' || redisStatus === 'up';
    const status: 'ok' | 'degraded' = dbOk && redisOk ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        redis: redisStatus,
        memory: { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      },
    };
  }
}
