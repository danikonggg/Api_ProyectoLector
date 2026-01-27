/**
 * ============================================
 * CONTROLADOR PRINCIPAL
 * ============================================
 * 
 * Este controlador maneja las rutas principales de la API.
 * Las rutas aquí son públicas y no requieren autenticación.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('General')
@Controller() // Sin prefijo, las rutas serán directamente / y /health
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Ruta: GET /
   * Descripción: Mensaje de bienvenida
   */
  @Get()
  @ApiOperation({ summary: 'Mensaje de bienvenida' })
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Ruta: GET /health
   * Descripción: Verificar el estado de la API
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check - Verificar estado de la API' })
  healthCheck() {
    return {
      status: 'ok',
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
    };
  }
}
