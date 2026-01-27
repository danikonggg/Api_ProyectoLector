/**
 * ============================================
 * GUARD: AdminOrDirectorGuard
 * ============================================
 * 
 * Guard que verifica que el usuario autenticado sea un administrador O un director.
 * Se usa para permitir que tanto admins como directores accedan a ciertas rutas.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminOrDirectorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const esAdmin = user.tipoPersona === 'administrador' && user.administrador;
    const esDirector = user.tipoPersona === 'director' && user.director;

    if (!esAdmin && !esDirector) {
      throw new ForbiddenException('Solo los administradores o directores pueden acceder a esta ruta');
    }

    return true;
  }
}
