/**
 * ============================================
 * GUARD: AdminGuard
 * ============================================
 * 
 * Guard que verifica que el usuario autenticado sea un administrador.
 * Se usa después de JwtAuthGuard para proteger rutas de admin.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.tipoPersona !== 'administrador' || !user.administrador) {
      throw new ForbiddenException('Solo los administradores pueden acceder a esta ruta');
    }

    return true;
  }
}
