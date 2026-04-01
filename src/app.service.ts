import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
      memory?: { heapUsed: number; heapTotal: number };
    };
  }> {
    let dbStatus: 'up' | 'down' = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      // DB no disponible
    }

    const mem = process.memoryUsage();
    const status = dbStatus === 'up' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        memory: { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      },
    };
  }
}
