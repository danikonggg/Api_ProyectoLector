/**
 * GUARD: AdminOrDirectorOrAlumnoGuard
 * Permite acceso a administradores, directores o alumnos.
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminOrDirectorOrAlumnoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const esAdmin = user.tipoPersona === 'administrador' && user.administrador;
    const esDirector = user.tipoPersona === 'director' && user.director;
    const esAlumno = user.tipoPersona === 'alumno' && user.alumno;

    if (!esAdmin && !esDirector && !esAlumno) {
      throw new ForbiddenException(
        'Solo administradores, directores o alumnos pueden acceder',
      );
    }

    return true;
  }
}
