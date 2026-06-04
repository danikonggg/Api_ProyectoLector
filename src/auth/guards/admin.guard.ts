import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('administrador') + RolesGuard instead */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    if (!user?.administrador || user.tipoPersona !== 'administrador') {
      throw new ForbiddenException('Solo los administradores pueden acceder a esta ruta');
    }
    return true;
  }
}
