/**
 * GUARD: AlumnoGuard
 * Solo permite acceso a usuarios con rol alumno.
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class AlumnoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const esAlumno = user.tipoPersona === 'alumno' && user.alumno;

    if (!esAlumno) {
      throw new ForbiddenException('Solo los alumnos pueden acceder a esta ruta');
    }

    return true;
  }
}
