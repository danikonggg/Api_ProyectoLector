import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('alumno') + RolesGuard instead */
@Injectable()
export class AlumnoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    if (!user?.alumno || user.tipoPersona !== 'alumno') {
      throw new ForbiddenException('Solo los alumnos pueden acceder a esta ruta');
    }
    return true;
  }
}
