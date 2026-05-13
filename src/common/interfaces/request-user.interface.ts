export interface RequestUser {
  id: number;
  correo: string;
  tipoPersona: string;
  activo: boolean;
  administrador?: { id: number };
  director?: {
    id: number;
    escuelaId?: number;
    escuela?: { id: number; nombre: string; nivel?: string; estado?: string };
  };
  maestro?: {
    id: number;
    escuelaId?: number;
    escuela?: { id: number; nombre: string; nivel?: string };
  };
  alumno?: {
    id: number;
    escuelaId?: number;
    personaId?: number;
    persona?: { id: number };
    escuela?: { id: number; nombre: string; nivel?: string };
  };
  padre?: { id: number };
}
