/**
 * ============================================
 * GUARD: MaestroGuard
 * ============================================
 * Verifica que el usuario autenticado sea un maestro.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class MaestroGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.tipoPersona !== 'maestro' || !user.maestro) {
      throw new ForbiddenException('Solo los maestros pueden acceder a esta ruta');
    }

    return true;
  }
}
