import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('administrador', 'director', 'alumno') + RolesGuard instead */
@Injectable()
export class AdminOrDirectorOrAlumnoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    const esAdmin = user?.tipoPersona === 'administrador' && user.administrador;
    const esDirector = user?.tipoPersona === 'director' && user.director;
    const esAlumno = user?.tipoPersona === 'alumno' && user.alumno;
    if (!esAdmin && !esDirector && !esAlumno) {
      throw new ForbiddenException(
        'Solo administradores, directores o alumnos pueden acceder a esta ruta',
      );
    }
    return true;
  }
}
