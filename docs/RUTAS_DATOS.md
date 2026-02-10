# Rutas API – Datos a enviar


## Sin autenticación

| Método | Ruta | Body |
|--------|------|------|
| GET | `/` | — |
| GET | `/health` | — |
| POST | `/auth/login` | `{ "email": "", "password": "" }` |
| POST | `/auth/registro-admin` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "telefono"?, "fechaNacimiento"?, "nivel"? }` |
| GET | `/personas/admins/cantidad` | — |

---

## Auth

| Método | Ruta | Body |
|--------|------|------|
| GET | `/auth/profile` | — |

---

## Personas

| Método | Ruta | Body |
|--------|------|------|
| POST | `/personas/registro-padre` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "telefono"?, "fechaNacimiento"? }` |
| POST | `/personas/registro-padre-con-hijo` | `{ "padre": { "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "telefono"? }, "hijo": { "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela", "grado"?, "grupo"?, "telefono"? } }` |
| POST | `/personas/registro-alumno` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela"*, "telefono"?, "fechaNacimiento"?, "grado"?, "grupo"?, "cicloEscolar"?, "padreId"?, "crearPadreAutomatico"? }` |
| POST | `/personas/registro-maestro` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela"*, "telefono"?, "fechaNacimiento"?, "especialidad"?, "fechaIngreso"? }` |
| POST | `/personas/registro-director` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela", "telefono"?, "fechaNacimiento"?, "fechaNombramiento"? }` |
| PUT | `/personas/padres/:id` | `{ "nombre"?, "apellido"?, "email"?, "password"?, "telefono"? }` |
| GET | `/personas/admins` | — |
| GET | `/personas/alumnos` | Query: `?escuelaId=&page=&limit=` (opcional) |
| GET | `/personas/alumnos/buscar` | Query: `campo`, `valor` (búsqueda global) |
| GET | `/personas/alumnos/:id` | — |
| GET | `/personas/alumnos/:id/padre` | — |
| GET | `/personas/padres` | — |
| GET | `/personas/padres/:id` | — |
| GET | `/personas/padres/:id/alumnos` | — |

*Admin: `idEscuela` obligatorio. Director: opcional (usa su escuela).

---

## Escuelas

| Método | Ruta | Body |
|--------|------|------|
| POST | `/escuelas` | `{ "nombre", "nivel", "clave"?, "direccion"?, "telefono"? }` |
| PUT | `/escuelas/:id` | `{ "nombre"?, "nivel"?, "clave"?, "direccion"?, "telefono"? }` |
| POST | `/escuelas/:id/libros` | `{ "codigo": "LIB-..." }` |
| POST | `/escuelas/:id/libros/canjear` | `{ "codigo": "LIB-..." }` |
| GET | `/escuelas` | — |
| GET | `/escuelas/:id` | — |
| GET | `/escuelas/:id/libros` | — |
| GET | `/escuelas/:id/libros/pendientes` | — |
| GET | `/escuelas/:id/maestros` | — |
| GET | `/escuelas/:id/alumnos` | — |
| GET | `/escuelas/mis-libros` | — (solo alumno) |
| DELETE | `/escuelas/:id` | — |

---

## Libros

| Método | Ruta | Body / Form |
|--------|------|-------------|
| POST | `/libros/cargar` | **FormData:** `pdf` (File), `titulo`, `grado`, `descripcion`?, `codigo`?, `materiaId`? |
| GET | `/libros` | — |
| GET | `/libros/:id` | — |
| GET | `/libros/:id/pdf` | — |
| DELETE | `/libros/:id` | — |

---

## Maestros

| Método | Ruta | Body |
|--------|------|------|
| POST | `/maestros/asignar-alumno` | `{ "alumnoId", "materiaId" }` |
| GET | `/maestros/mis-alumnos` | — |
| GET | `/maestros/mis-alumnos/:id` | — |
| DELETE | `/maestros/mis-alumnos/:alumnoId/materia/:materiaId` | — |

---

## Campos mínimos obligatorios (resumen)

| Registro | Obligatorios |
|----------|--------------|
| Login | `email`, `password` |
| Admin | `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password` |
| Padre | `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password` |
| Alumno | `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password`, `idEscuela`* |
| Maestro | `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password`, `idEscuela`* |
| Director | `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password`, `idEscuela` |
| Escuela | `nombre`, `nivel` |
| Cargar libro | `pdf`, `titulo`, `grado` |
| Otorgar libro | `codigo` |
| Canjear libro | `codigo` |
| Asignar alumno | `alumnoId`, `materiaId` |
