/**
 * Centralización de endpoints de la API.
 * Todas las rutas relativas a la base URL configurada.
 */
export const ENDPOINTS = {
  // Auth
  auth: {
    login: 'POST /auth/login',
    profile: 'GET /auth/profile',
    registroAdmin: 'POST /auth/registro-admin',
  },

  // Personas
  personas: {
    adminsCantidad: 'GET /personas/admins/cantidad',
    registroPadre: 'POST /personas/registro-padre',
    registroAlumno: 'POST /personas/registro-alumno',
    registroMaestro: 'POST /personas/registro-maestro',
    registroDirector: 'POST /personas/registro-director',
    alumnos: 'GET /personas/alumnos',
    alumnosBuscar: 'GET /personas/alumnos/buscar',
    alumnoById: (id) => `GET /personas/alumnos/${id}`,
    padres: 'GET /personas/padres',
    padreById: (id) => `GET /personas/padres/${id}`,
    padreAlumnos: (id) => `GET /personas/padres/${id}/alumnos`,
  },

  // Escuelas
  escuelas: {
    lista: 'GET /escuelas/lista',
    todas: 'GET /escuelas',
    byId: (id) => `GET /escuelas/${id}`,
    misLibros: 'GET /escuelas/mis-libros',
    misLibrosProgreso: (libroId) => `PATCH /escuelas/mis-libros/${libroId}/progreso`,
    libros: (id) => `GET /escuelas/${id}/libros`,
    librosPendientes: (id) => `GET /escuelas/${id}/libros/pendientes`,
    maestros: (id) => `GET /escuelas/${id}/maestros`,
    alumnos: (id) => `GET /escuelas/${id}/alumnos`,
    directores: (id) => `GET /escuelas/${id}/directores`,
    directoresTodos: 'GET /escuelas/directores',
    otorgarLibro: (id) => `POST /escuelas/${id}/libros`,
    canjearLibro: (id) => `POST /escuelas/${id}/libros/canjear`,
  },

  // Director (sin id en ruta, usa token)
  director: {
    dashboard: 'GET /director/dashboard',
    escuela: 'GET /director/escuela',
    libros: 'GET /director/libros',
    librosPendientes: 'GET /director/libros/pendientes',
    canjearLibro: 'POST /director/canjear-libro',
    maestros: 'GET /director/maestros',
    alumnos: 'GET /director/alumnos',
    librosDisponiblesParaAsignar: (alumnoId) => `GET /director/libros-disponibles-para-asignar?alumnoId=${alumnoId}`,
    asignarLibro: 'POST /director/asignar-libro',
    desasignarLibro: (alumnoId, libroId) => `DELETE /director/desasignar-libro/${alumnoId}/${libroId}`,
  },

  // Maestros
  maestros: {
    misAlumnos: 'GET /maestros/mis-alumnos',
    alumnoById: (id) => `GET /maestros/mis-alumnos/${id}`,
    asignarAlumno: 'POST /maestros/asignar-alumno',
    desasignarAlumno: (alumnoId, materiaId) => `DELETE /maestros/mis-alumnos/${alumnoId}/materia/${materiaId}`,
    librosDisponiblesParaAsignar: (alumnoId) => `GET /maestros/libros-disponibles-para-asignar?alumnoId=${alumnoId}`,
    asignarLibro: 'POST /maestros/asignar-libro',
    desasignarLibro: (alumnoId, libroId) => `DELETE /maestros/desasignar-libro/${alumnoId}/${libroId}`,
  },

  // Libros
  libros: {
    todos: 'GET /libros',
    byId: (id) => `GET /libros/${id}`,
    pdf: (id) => `GET /libros/${id}/pdf`,
    cargar: 'POST /libros/cargar',
    eliminar: (id) => `DELETE /libros/${id}`,
  },

  // Admin
  admin: {
    dashboard: 'GET /admin/dashboard',
    usuarios: 'GET /admin/usuarios',
  },

  // Audit
  audit: {
    logs: (page = 1, limit = 20) => `GET /audit?page=${page}&limit=${limit}`,
  },
};
