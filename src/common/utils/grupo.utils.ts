/**
 * Utilidades para comparación de grupos.
 * Normalización: trim + mayúsculas para evitar "A" vs "a".
 */

export function normalizarGrupo(s: string | undefined | null): string {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toUpperCase();
}

export function grupoCoincide(
  gradoAlumno: number,
  grupoAlumno: string | null | undefined,
  gradoGrupo: number,
  nombreGrupo: string | null | undefined,
): boolean {
  if (Number(gradoAlumno) !== Number(gradoGrupo)) return false;
  return normalizarGrupo(grupoAlumno) === normalizarGrupo(nombreGrupo);
}

/**
 * Verifica si un alumno pertenece a alguno de los grupos del maestro.
 * Prioriza grupoId si está presente; si no, usa grado+grupo con normalización.
 */
export function alumnoPerteneceAGrupos(
  alumno: { grupoId?: number | null; grado?: number; grupo?: string | null },
  maestroGrupos: Array<{ grupo?: { id: number; grado: number; nombre: string } | null }>,
): boolean {
  const grupos = maestroGrupos.map((mg) => mg.grupo).filter(Boolean);
  if (grupos.length === 0) return false;

  if (alumno.grupoId != null) {
    return grupos.some((g) => g && Number(g.id) === Number(alumno.grupoId));
  }

  const gradoA = Number(alumno.grado ?? 0);
  const grupoA = alumno.grupo;
  return grupos.some((g) => g && grupoCoincide(gradoA, grupoA, Number(g.grado), g.nombre));
}
