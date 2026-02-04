/**
 * ============================================
 * SERVICIO PRINCIPAL
 * ============================================
 * 
 * Este servicio contiene la lógica de negocio para las rutas principales.
 * Los servicios en NestJS son clases marcadas con @Injectable()
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Retorna un mensaje de bienvenida
   */
  getHello(): string {
    return '¡Bienvenido a la API,  TEAM VL!';
  }
}
