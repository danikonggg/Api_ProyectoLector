/**
 * ============================================
 * SERVICIO PRINCIPAL
 * ============================================
 *
 * Este servicio contiene la lógica de negocio para las rutas principales.
 * Los servicios en NestJS son clases marcadas con @Injectable()
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retorna un mensaje de bienvenida
   */
  getHello(): string {
    return '¡Bienvenido a la API,  TEAM VL!';
  }

  /**
   * Health check incluyendo verificación de conexión a la base de datos
   */
  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    message: string;
    timestamp: string;
    database?: 'connected' | 'disconnected';
  }> {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      // DB no disponible
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      message:
        dbStatus === 'connected'
          ? 'API funcionando correctamente'
          : 'API funcionando pero la base de datos no está disponible',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  }
}
