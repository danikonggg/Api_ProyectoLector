/**
 * ============================================
 * GUARD: DirectorGuard
 * ============================================
 * 
 * Guard que verifica que el usuario autenticado sea un director.
 * Se usa después de JwtAuthGuard para proteger rutas de director.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class DirectorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.tipoPersona !== 'director' || !user.director) {
      throw new ForbiddenException('Solo los directores pueden acceder a esta ruta');
    }

    return true;
  }
}
