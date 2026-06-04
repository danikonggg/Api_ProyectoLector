import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, TipoPersona } from '../decorators/roles.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';

const ROLE_RELATION: Record<TipoPersona, keyof RequestUser> = {
  administrador: 'administrador',
  director: 'director',
  maestro: 'maestro',
  alumno: 'alumno',
  padre: 'padre',
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TipoPersona[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const hasRole = requiredRoles.some(
      (role) => user.tipoPersona === role && user[ROLE_RELATION[role]] != null,
    );

    if (!hasRole) {
      const rolesStr = requiredRoles.join(', ');
      throw new ForbiddenException(
        `Acceso restringido. Roles permitidos: ${rolesStr}`,
      );
    }

    return true;
  }
}
