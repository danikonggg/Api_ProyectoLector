export function formatearAlumnoConPadre(alumno: any) {
  return {
    id: alumno.id,
    personaId: alumno.personaId,
    escuelaId: alumno.escuelaId,
    padreId: alumno.padreId ?? null,
    grado: alumno.grado,
    grupo: alumno.grupo,
    grupoId: alumno.grupoId ?? null,
    cicloEscolar: alumno.cicloEscolar,
    persona: alumno.persona
      ? {
          id: alumno.persona.id,
          nombre: alumno.persona.nombre,
          apellidoPaterno: alumno.persona.apellidoPaterno,
          apellidoMaterno: alumno.persona.apellidoMaterno ?? null,
          correo: alumno.persona.correo,
          telefono: alumno.persona.telefono,
          genero: alumno.persona.genero ?? null,
        }
      : null,
    escuela: alumno.escuela
      ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre, nivel: alumno.escuela.nivel }
      : null,
    padre: alumno.padre
      ? {
          id: alumno.padre.id,
          parentesco: alumno.padre.parentesco,
          persona: alumno.padre.persona
            ? {
                id: alumno.padre.persona.id,
                nombre: alumno.padre.persona.nombre,
                apellidoPaterno: alumno.padre.persona.apellidoPaterno,
                apellidoMaterno: alumno.padre.persona.apellidoMaterno ?? null,
                correo: alumno.padre.persona.correo,
                telefono: alumno.padre.persona.telefono,
                genero: alumno.padre.persona.genero ?? null,
              }
            : null,
        }
      : null,
  };
}

export function formatearAlumnoParaLista(alumno: any) {
  return {
    id: alumno.id,
    personaId: alumno.personaId,
    escuelaId: alumno.escuelaId,
    grado: alumno.grado,
    grupo: alumno.grupo,
    grupoId: alumno.grupoId ?? null,
    cicloEscolar: alumno.cicloEscolar,
    persona: alumno.persona
      ? {
          id: alumno.persona.id,
          nombre: alumno.persona.nombre,
          apellidoPaterno: alumno.persona.apellidoPaterno,
          apellidoMaterno: alumno.persona.apellidoMaterno ?? null,
          correo: alumno.persona.correo,
          telefono: alumno.persona.telefono,
          genero: alumno.persona.genero ?? null,
        }
      : null,
    escuela: alumno.escuela ? { id: alumno.escuela.id, nombre: alumno.escuela.nombre } : null,
  };
}

export function formatearPadreConAlumnos(padre: any) {
  const correo = padre.persona?.correo || '';
  const pendiente = correo.includes('@temp.local');
  return {
    id: padre.id,
    personaId: padre.personaId,
    parentesco: padre.parentesco,
    pendiente,
    persona: padre.persona
      ? {
          id: padre.persona.id,
          nombre: padre.persona.nombre,
          apellidoPaterno: padre.persona.apellidoPaterno,
          apellidoMaterno: padre.persona.apellidoMaterno ?? null,
          correo: padre.persona.correo,
          telefono: padre.persona.telefono,
          genero: padre.persona.genero ?? null,
        }
      : null,
    cantidadHijos: (padre.alumnos || []).length,
    alumnos: (padre.alumnos || []).map((a: any) => formatearAlumnoParaLista(a)),
  };
}

export function formatearMaestro(maestro: any) {
  return {
    id: maestro.id,
    personaId: maestro.personaId,
    escuelaId: maestro.escuelaId,
    especialidad: maestro.especialidad ?? null,
    fechaContratacion: maestro.fechaContratacion ?? null,
    activo: maestro.activo ?? true,
    persona: maestro.persona
      ? {
          id: maestro.persona.id,
          nombre: maestro.persona.nombre,
          apellidoPaterno: maestro.persona.apellidoPaterno,
          apellidoMaterno: maestro.persona.apellidoMaterno ?? null,
          correo: maestro.persona.correo,
          telefono: maestro.persona.telefono,
          genero: maestro.persona.genero ?? null,
        }
      : null,
    escuela: maestro.escuela
      ? {
          id: maestro.escuela.id,
          nombre: maestro.escuela.nombre,
          nivel: maestro.escuela.nivel,
        }
      : null,
  };
}
