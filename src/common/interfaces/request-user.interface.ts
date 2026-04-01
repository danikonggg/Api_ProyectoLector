import type { Administrador } from '../../personas/entities/administrador.entity';
import type { Director } from '../../personas/entities/director.entity';
import type { Maestro } from '../../personas/entities/maestro.entity';
import type { Alumno } from '../../personas/entities/alumno.entity';
import type { Padre } from '../../personas/entities/padre.entity';
import type { Escuela } from '../../personas/entities/escuela.entity';

export interface RequestUser {
  id: number;
  correo: string;
  tipoPersona: string;
  activo: boolean;
  administrador?: Administrador;
  director?: Director & { escuela?: Escuela };
  maestro?: Maestro & { escuela?: Escuela };
  alumno?: Alumno & { escuela?: Escuela };
  padre?: Padre;
}
