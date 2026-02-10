# API Pruebas — Estado

Los **endpoints de pruebas** (sin token) fueron **eliminados**.

Para registrar alumnos, padres o listar escuelas usa los endpoints normales con JWT:

- **Login:** `POST /auth/login` → header `Authorization: Bearer <access_token>`
- **Escuelas:** `GET /escuelas` (admin)
- **Registro alumno:** `POST /personas/registro-alumno` (admin o director)
- **Registro padre:** `POST /personas/registro-padre` (admin)
- **Listar alumnos:** `GET /personas/alumnos` (admin o director)
- **Listar padres:** `GET /personas/padres` (admin)

Ver [RUTAS_ADMIN_FRONTEND.md](./RUTAS_ADMIN_FRONTEND.md) y [API_DOCUMENTACION_FRONTEND.md](./API_DOCUMENTACION_FRONTEND.md).
