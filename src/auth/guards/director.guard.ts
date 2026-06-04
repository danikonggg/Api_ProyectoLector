import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('director') + RolesGuard instead */
@Injectable()
export class DirectorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    if (!user?.director || user.tipoPersona !== 'director') {
      throw new ForbiddenException('Solo los directores pueden acceder a esta ruta');
    }
    return true;
  }
}
