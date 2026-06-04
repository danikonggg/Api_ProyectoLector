import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/request-user.interface';

/** @deprecated Use @Roles('maestro') + RolesGuard instead */
@Injectable()
export class MaestroGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();
    if (!user?.maestro || user.tipoPersona !== 'maestro') {
      throw new ForbiddenException('Solo los maestros pueden acceder a esta ruta');
    }
    return true;
  }
}
