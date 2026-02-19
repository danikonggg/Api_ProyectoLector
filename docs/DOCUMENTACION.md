# API Lector – Documentación completa

API REST para sistema educativo: roles (Administrador, Director, Maestro, Alumno, Padre), autenticación JWT, escuelas, libros digitales y auditoría.

**Stack:** NestJS, TypeORM, PostgreSQL, JWT, Swagger (solo desarrollo).

---

## Índice

1. [Inicio rápido](#1-inicio-rápido)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Autenticación](#3-autenticación)
4. [Referencia de rutas](#4-referencia-de-rutas)
5. [Endpoints por recurso](#5-endpoints-por-recurso)
6. [Seguridad](#6-seguridad)
7. [Auditoría](#7-auditoría)
8. [Capacidad y escalado](#8-capacidad-y-escalado)
9. [Flujos resumidos](#9-flujos-resumidos)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Scripts y producción](#11-scripts-y-producción)

---

## 1. Inicio rápido

### Requisitos

- Node.js 18+
- PostgreSQL
- npm o yarn

### Instalación y configuración

```bash
npm install
cp .env.example .env
# Editar .env con DB_*, JWT_SECRET, etc.
```

### Base de datos

Crear la base `api_lector` y ejecutar migraciones en orden:

```bash
psql -U postgres -d api_lector -f migrations/complete_database_setup.sql
psql -U postgres -d api_lector -f migrations/add_audit_log.sql
psql -U postgres -d api_lector -f migrations/add_escuela_libro_pendiente.sql
# Según necesidad: add_director_table.sql, add_libros_unidades_segmentos.sql, add_ruta_pdf_libro.sql, etc.
```

### Ejecutar

```bash
npm run start:dev
```

| Recurso      | URL |
|-------------|-----|
| API         | `http://localhost:3000` |
| Swagger     | `http://localhost:3000/api` (solo desarrollo) |
| Health      | `http://localhost:3000/health` |

---

## 2. Roles y permisos

| Rol | Alcance |
|-----|---------|
| **Administrador** | Todo: escuelas, directores, padres, libros, auditoría. Máx. 5 admins. |
| **Director** | Solo su escuela: alumnos, maestros, canjear libros. No envía `idEscuela` (se usa el del token). |
| **Maestro** | Alumnos asignados a sus materias. |
| **Alumno** | Libros asignados a su escuela (ver y listar). |
| **Padre** | Vinculado a uno o más alumnos (hijos). |

Casi todos los endpoints requieren **JWT**: `Authorization: Bearer <access_token>`. Excepciones: `GET /`, `GET /health`, `POST /auth/login`, y opcionalmente `GET /personas/admins/cantidad`, `POST /auth/registro-admin` (hasta 5 admins).

---

## 3. Autenticación

### Login

**`POST /auth/login`** (público)

Body:
```json
{ "email": "usuario@example.com", "password": "tu_password" }
```

Respuesta 200:
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "24h",
  "user": {
    "idPersona": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "usuario@example.com",
    "tipoPersona": "administrador"
  }
}
```

Usar `access_token` en todas las peticiones protegidas: `Authorization: Bearer <access_token>`.

### Perfil

**`GET /auth/profile`** — Requiere JWT. Devuelve datos del usuario autenticado.

### Registro de administrador

**`POST /auth/registro-admin`** — Público o con JWT de admin. Máx. 5 admins. Body: `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password`; opcionales: `telefono`, `fechaNacimiento`, `nivel`.

### Ver cupo de admins

**`GET /personas/admins/cantidad`** — Público. Devuelve cuántos admins hay y cuántos se pueden registrar aún.

---

## 4. Referencia de rutas

Todas las rutas con método, body mínimo y rol. `?` = opcional. `*` = ver nota al pie.

### Sin autenticación

| Método | Ruta | Body |
|--------|------|------|
| GET | `/` | — |
| GET | `/health` | — |
| POST | `/auth/login` | `{ "email", "password" }` |
| POST | `/auth/registro-admin` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password" }` + opc. |
| GET | `/personas/admins/cantidad` | — |

### Auth (JWT)

| Método | Ruta | Body |
|--------|------|------|
| GET | `/auth/profile` | — |

### Personas (Admin o Director según ruta)

| Método | Ruta | Body |
|--------|------|------|
| POST | `/personas/registro-padre` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password" }` + opc. |
| POST | `/personas/registro-padre-con-hijo` | `{ "padre": { ... }, "hijo": { ..., "idEscuela" } }` |
| POST | `/personas/registro-alumno` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela"* }` + opc. |
| POST | `/personas/registro-maestro` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela"* }` + opc. |
| POST | `/personas/registro-director` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela" }` + opc. |
| PUT | `/personas/padres/:id` | `{ "nombre"?, "apellido"?, "email"?, "password"?, "telefono"? }` |
| GET | `/personas/admins` | — |
| GET | `/personas/alumnos` | Query: `?escuelaId=&page=&limit=` |
| GET | `/personas/alumnos/buscar` | Query: `campo`, `valor` |
| GET | `/personas/alumnos/:id` | — |
| GET | `/personas/alumnos/:id/padre` | — |
| GET | `/personas/padres` | — |
| GET | `/personas/padres/:id` | — |
| GET | `/personas/padres/:id/alumnos` | — |

*Director: puede omitir `idEscuela` (se usa su escuela).

### Escuelas

| Método | Ruta | Body |
|--------|------|------|
| POST | `/escuelas` | `{ "nombre", "nivel" }` + opc. |
| PUT | `/escuelas/:id` | `{ "nombre"?, "nivel"?, "clave"?, "direccion"?, "telefono"? }` |
| POST | `/escuelas/:id/libros` | `{ "codigo": "LIB-..." }` (admin otorga) |
| POST | `/escuelas/:id/libros/canjear` | `{ "codigo": "LIB-..." }` (admin o director) |
| GET | `/escuelas` | — |
| GET | `/escuelas/:id` | — |
| GET | `/escuelas/:id/libros` | — |
| GET | `/escuelas/:id/libros/pendientes` | — |
| GET | `/escuelas/:id/maestros` | — |
| GET | `/escuelas/:id/alumnos` | — |
| GET | `/escuelas/mis-libros` | — (solo alumno) |
| DELETE | `/escuelas/:id` | — |

### Libros

| Método | Ruta | Body / Form |
|--------|------|-------------|
| POST | `/libros/cargar` | **FormData:** `pdf` (File), `titulo`, `grado`; opc.: `descripcion`, `codigo`, `materiaId` (máx. 50 MB) |
| GET | `/libros` | — (admin) |
| GET | `/libros/:id` | — (admin, director, alumno* ) |
| GET | `/libros/:id/pdf` | — (solo admin) |
| DELETE | `/libros/:id` | — (admin) |

*Alumno: solo libros de su escuela.

### Director (sin enviar idEscuela)

| Método | Ruta | Body |
|--------|------|------|
| GET | `/director/dashboard` | — |
| GET | `/director/libros` | — |
| GET | `/director/libros/pendientes` | — |
| POST | `/director/canjear-libro` | `{ "codigo": "LIB-..." }` |

### Maestros

| Método | Ruta | Body |
|--------|------|------|
| POST | `/maestros/asignar-alumno` | `{ "alumnoId", "materiaId" }` |
| GET | `/maestros/mis-alumnos` | — |
| GET | `/maestros/mis-alumnos/:id` | — |
| DELETE | `/maestros/mis-alumnos/:alumnoId/materia/:materiaId` | — |

### Admin

| Método | Ruta | Body |
|--------|------|------|
| GET | `/admin/dashboard` | — |
| GET | `/admin/usuarios` | — |

### Auditoría (solo admin)

| Método | Ruta | Query |
|--------|------|-------|
| GET | `/audit` | `?page=1&limit=20` |

### Campos mínimos por registro

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
| Otorgar/Canjear libro | `codigo` |
| Asignar alumno (maestro) | `alumnoId`, `materiaId` |

---

## 5. Endpoints por recurso

### Admin

- **GET /admin/dashboard**: `data`: `{ escuelasActivas, totalEstudiantes, totalProfesores, librosDisponibles }`.
- **GET /admin/usuarios**: Lista de usuarios y totales por rol (administrador, director, maestro, alumno, padre).

### Director

- **GET /director/dashboard**: `data`: `{ escuela, totalEstudiantes, totalProfesores, librosDisponibles }`. La escuela es la del token.
- **GET /director/libros**: Libros ya canjeados en su escuela.
- **GET /director/libros/pendientes**: Libros otorgados por admin que la escuela aún no ha canjeado (director ve título/grado, no código).
- **POST /director/canjear-libro**: Body `{ "codigo": "LIB-..." }`. Canjea el libro para su escuela.

### Libros (admin: catálogo y PDF)

- **POST /libros/cargar**: `multipart/form-data`: campo `pdf` (archivo), `titulo`, `grado`; opc. `descripcion`, `codigo`, `materiaId`. Máx. 50 MB. Backend extrae texto, segmenta y opcionalmente genera preguntas con IA.
- **GET /libros**: Lista todos los libros (admin).
- **GET /libros/:id**: Detalle con unidades y segmentos. Alumno solo si el libro está en su escuela.
- **GET /libros/:id/pdf**: Descarga el PDF (solo admin).
- **DELETE /libros/:id**: Elimina libro, asignaciones y archivo (solo admin).

### Escuelas y libros (doble verificación)

1. Admin **otorga** libro a una escuela: `POST /escuelas/:id/libros` con `{ "codigo": "LIB-..." }` → queda en “pendiente”.
2. Admin o director de esa escuela **canjea**: `POST /escuelas/:id/libros/canjear` con el mismo `codigo` → el libro pasa a activo en la escuela.
Sin canje, el libro no aparece en la escuela. Director puede ver pendientes en `GET /escuelas/:id/libros/pendientes` (sin código) y canjear con el código que le entregue el admin.

---

## 6. Seguridad

- **JWT**: Tokens firmados con `JWT_SECRET`, expiración 24h. En producción: mínimo 32 caracteres, sin valor de ejemplo.
- **Contraseñas**: bcrypt (10 rounds). Nunca en texto plano ni en respuestas.
- **Autorización**: Guards por rol (Admin, Director, Maestro, Alumno, AdminOrDirector, etc.). Director solo accede a su escuela; alumno solo a libros de su escuela.
- **Validación**: ValidationPipe global (`whitelist`, `forbidNonWhitelisted`, `transform`). DTOs con class-validator. TypeORM con consultas parametrizadas.
- **CORS**: En producción configurar `CORS_ORIGINS` (dominios del frontend separados por coma).
- **Rate limiting**: Throttler por IP (configurable `THROTTLE_LIMIT_PER_MIN`, default 500 req/min).
- **Producción**: Swagger y endpoints de prueba desactivados. No se expone stack trace en errores.

**Endpoints públicos:** `GET /`, `GET /health`, `POST /auth/login`. Opcionalmente `GET /personas/admins/cantidad` y `POST /auth/registro-admin` (hasta 5 admins). El resto requiere JWT.

---

## 7. Auditoría

**GET /audit** — Solo administrador. Query: `page`, `limit`. Lista logs de acciones sensibles.

Acciones registradas: `login`, `login_fallido`, `registro_admin`, `registro_padre`, `registro_alumno`, `registro_maestro`, `registro_director`, `escuela_crear`, `escuela_actualizar`, `escuela_eliminar`, `libro_cargar`, `libro_eliminar`.

Migración: `migrations/add_audit_log.sql`.

---

## 8. Capacidad y escalado

La API está preparada para **~200 usuarios concurrentes** por instancia (pool 80, throttle 500 req/min por IP).

| Variable | Default | Uso |
|----------|---------|-----|
| `DB_POOL_SIZE` | 80 | Conexiones máximas en el pool TypeORM. PostgreSQL `max_connections` debe ser ≥ este valor. |
| `THROTTLE_LIMIT_PER_MIN` | 500 | Peticiones por minuto por IP. |

- Más de 80 peticiones usando DB a la vez: el resto **espera en cola** (no tumba la API).
- Más de 500 req/min por IP: respuestas **429** (Too Many Requests).
- Para más usuarios: subir pool y throttle, o desplegar varias instancias detrás de un balanceador. Cargas de PDF simultáneas (1–2 a la vez) son manejables; más pueden saturar CPU y Groq.

---

## 9. Flujos resumidos

### Inicialización

1. Crear DB y ejecutar migraciones.
2. Registrar hasta 5 admins con `POST /auth/registro-admin` (o comprobar cupo con `GET /personas/admins/cantidad`).
3. Login con `POST /auth/login` y usar el token en el resto de peticiones.

### Libros en una escuela (doble verificación)

1. Admin carga libro → `POST /libros/cargar`.
2. Admin otorga a escuela → `POST /escuelas/:id/libros` con `{ "codigo": "LIB-..." }`.
3. Director ve pendientes → `GET /escuelas/:id/libros/pendientes` (o `GET /director/libros/pendientes`).
4. Director canjea con el código recibido → `POST /escuelas/:id/libros/canjear` o `POST /director/canjear-libro`.
5. Libro activo en la escuela → `GET /escuelas/:id/libros` o `GET /director/libros`.

### Padre y alumno

- **Padre + hijo juntos:** `POST /personas/registro-padre-con-hijo` con datos de padre e hijo.
- **Solo alumno:** `POST /personas/registro-alumno` (opcional `padreId` o `crearPadreAutomatico: true`).
- **Solo padre:** `POST /personas/registro-padre`. Después vincular alumno o usar registro alumno con `padreId`.
- **Completar padre creado automático:** `PUT /personas/padres/:id` con nombre, email, etc.

---

## 10. Variables de entorno

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `NODE_ENV` | No | `development` \| `production` |
| `PORT` | No | Puerto del servidor (default 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Sí | PostgreSQL |
| `DB_POOL_SIZE` | No | Pool de conexiones (default 80) |
| `DB_LOG_QUERIES` | No | `true` \| `false` (solo desarrollo) |
| `JWT_SECRET` | Sí (prod.) | Mín. 32 caracteres en producción |
| `JWT_EXPIRES_IN` | No | Ej. `24h` |
| `CORS_ORIGINS` | Prod. | Orígenes permitidos separados por coma |
| `THROTTLE_LIMIT_PER_MIN` | No | Default 500 |
| `GROQ_API_KEY` | No | Para generación de preguntas por IA en libros |

Ver `.env.example` para plantilla.

---

## 11. Scripts y producción

```bash
npm run start:dev    # Desarrollo con hot-reload
npm run build        # Compilar
npm run start:prod   # Producción (node dist/main)
npm run lint         # Linter
```

### Checklist producción

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` con al menos 32 caracteres aleatorios
- [ ] `CORS_ORIGINS` con dominios del frontend
- [ ] PostgreSQL con credenciales seguras y `max_connections` ≥ `DB_POOL_SIZE`
- [ ] HTTPS en el proxy/servidor (Nginx, etc.)

---

*Última actualización: Febrero 2025*




