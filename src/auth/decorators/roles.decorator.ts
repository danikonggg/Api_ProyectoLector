import { SetMetadata } from '@nestjs/common';

export type TipoPersona =
  | 'administrador'
  | 'director'
  | 'maestro'
  | 'alumno'
  | 'padre';

export const ROLES_KEY = 'roles';

/** Restricts a route to one or more person types. */
export const Roles = (...roles: TipoPersona[]) => SetMetadata(ROLES_KEY, roles);
