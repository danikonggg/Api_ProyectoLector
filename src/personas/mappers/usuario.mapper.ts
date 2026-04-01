import type { Persona } from '../entities/persona.entity';

export interface UsuarioListItem {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  correo: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  genero: string | null;
  tipoPersona: string;
  activo: boolean;
  ultimaConexion: string | null;
  rolId?: number;
  escuela?: { id: number; nombre: string; nivel: string };
}

export function mapPersonaToUsuarioListItem(p: Persona): UsuarioListItem {
  const base = {
    id: p.id,
    nombre: p.nombre,
    apellidoPaterno: p.apellidoPaterno,
    apellidoMaterno: p.apellidoMaterno ?? null,
    correo: p.correo ?? null,
    telefono: p.telefono ?? null,
    genero: p.genero ?? null,
    fechaNacimiento: p.fechaNacimiento
      ? (p.fechaNacimiento instanceof Date ? p.fechaNacimiento.toISOString().split('T')[0] : String(p.fechaNacimiento).split('T')[0])
      : null,
    tipoPersona: p.tipoPersona ?? 'desconocido',
    activo: p.activo ?? true,
    ultimaConexion: p.ultimaConexion
      ? (p.ultimaConexion instanceof Date ? p.ultimaConexion.toISOString() : String(p.ultimaConexion))
      : null,
  };
  let rolId: number | undefined;
  let escuela: { id: number; nombre: string; nivel: string } | undefined;

  if (p.administrador) {
    rolId = p.administrador.id;
  } else if (p.director) {
    rolId = p.director.id;
    if (p.director.escuela) {
      escuela = {
        id: p.director.escuela.id,
        nombre: p.director.escuela.nombre,
        nivel: p.director.escuela.nivel ?? '',
      };
    }
  } else if (p.maestro) {
    rolId = p.maestro.id;
    if (p.maestro.escuela) {
      escuela = {
        id: p.maestro.escuela.id,
        nombre: p.maestro.escuela.nombre,
        nivel: p.maestro.escuela.nivel ?? '',
      };
    }
  } else if (p.alumno) {
    rolId = p.alumno.id;
    if (p.alumno.escuela) {
      escuela = {
        id: p.alumno.escuela.id,
        nombre: p.alumno.escuela.nombre,
        nivel: p.alumno.escuela.nivel ?? '',
      };
    }
  } else if (p.padre) {
    rolId = p.padre.id;
  }

  return { ...base, ...(rolId !== undefined && { rolId }), ...(escuela && { escuela }) };
}
