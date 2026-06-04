import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('administrador', 'director') + RolesGuard instead */
@Injectable()
export class AdminOrDirectorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    const esAdmin = user?.tipoPersona === 'administrador' && user.administrador;
    const esDirector = user?.tipoPersona === 'director' && user.director;
    if (!esAdmin && !esDirector) {
      throw new ForbiddenException('Solo administradores o directores pueden acceder a esta ruta');
    }
    return true;
  }
}
