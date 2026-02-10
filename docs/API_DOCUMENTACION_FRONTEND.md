# Documentación API Lector – Equipo Frontend

Documento de referencia para consumir la API del sistema educativo. Incluye todos los endpoints, autenticación, cuerpos de petición y respuestas.

**Seguridad:** Ver [SEGURIDAD.md](./SEGURIDAD.md) para medidas implementadas y checklist de producción.

---

## Índice

1. [Configuración base](#1-configuración-base)
2. [Autenticación](#2-autenticación)
3. [General](#3-general)
4. [Personas (registros y admins)](#4-personas-registros-y-admins)
5. [Escuelas](#5-escuelas)
6. [Libros](#6-libros)
7. [Director](#7-director)
8. [Maestros](#8-maestros)
9. [Auditoría](#9-auditoría)
10. [Permisos por rol](#10-permisos-por-rol)
11. [Códigos de error](#11-códigos-de-error)

---

## 1. Configuración base

| Concepto | Valor |
|----------|--------|
| **Base URL** | `http://localhost:3000` (o la URL del backend en tu entorno) |
| **Swagger (interactivo)** | `http://localhost:3000/api` (solo en desarrollo; desactivado en producción) |
| **Health check** | `GET /health` |

### Autenticación JWT

- Casi todos los endpoints (excepto login, `/`, `/health`) requieren **JWT**.
- **Header**: `Authorization: Bearer <access_token>`.
- El `access_token` se obtiene con `POST /auth/login` (email + password).
- El token expira en **24h**; ante **401** hay que volver a hacer login.

---

## 2. Autenticación

### 2.1 Login

**`POST /auth/login`**  
No requiere token.

**Body** (`application/json`):

```json
{
  "email": "admin@example.com",
  "password": "tu_password"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `email` | string | Sí | Email del usuario |
| `password` | string | Sí | Contraseña (mín. 6 caracteres) |

**Respuesta 200:**

```json
{
  "message": "Login exitoso",
  "description": "Usuario autenticado correctamente. Usa el access_token para acceder a endpoints protegidos.",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "24h",
  "user": {
    "idPersona": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "admin@example.com",
    "tipoPersona": "administrador"
  }
}
```

- Guardar `access_token` y enviarlo en `Authorization: Bearer <access_token>`.
- `user.tipoPersona`: `administrador` \| `director` \| `maestro` \| `padre` \| `alumno`.

**Errores:** 401 (credenciales inválidas).

---

### 2.2 Registro de administrador

**`POST /auth/registro-admin`**  
Requiere: **JWT** + **Admin**. Solo administradores pueden crear nuevos admins. Máximo **5** administradores en el sistema.

**Body** (`application/json`):

```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "admin@example.com",
  "password": "password123",
  "telefono": "1234567890",
  "fechaNacimiento": "1990-01-01"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `nombre` | string | Sí | Nombre |
| `apellidoPaterno` | string | Sí | Apellido paterno |
| `apellidoMaterno` | string | Sí | Apellido materno |
| `email` | string | Sí | Email único |
| `password` | string | Sí | Mín. 6 caracteres |
| `telefono` | string | No | Teléfono |
| `fechaNacimiento` | string | No | ISO 8601 (YYYY-MM-DD) |

**Respuesta 201:** Admin creado; puede iniciar sesión con email y contraseña.

**Errores:** 401 (no autenticado), 403 (no es admin), 409 (email ya registrado o ya hay 5 admins).

---

### 2.3 Perfil del usuario autenticado

**`GET /auth/profile`**  
Requiere: **JWT** (cualquier usuario autenticado).

**Respuesta 200:** Objeto con datos del usuario (persona + rol según `tipoPersona`).

**Errores:** 401 (no autenticado).

---

## 3. General

### 3.1 Bienvenida

**`GET /`**  
Sin autenticación. Mensaje de bienvenida en texto.

---

### 3.2 Health check

**`GET /health`**  
Sin autenticación.

**Respuesta 200:**

```json
{
  "status": "ok",
  "message": "API funcionando correctamente",
  "timestamp": "2025-02-04T12:00:00.000Z",
  "database": "connected"
}
```

- `status`: `ok` si todo bien, `degraded` si la BD no está disponible.
- `database`: `connected` | `disconnected`.

---

## 4. Personas (registros y admins)

Todos los endpoints de esta sección requieren **JWT**. Los registros requieren el rol indicado en cada sección.

**📋 Flujo padre–alumno:** Ver [FLUJO_PADRE_ALUMNO.md](./FLUJO_PADRE_ALUMNO.md). Registro de alumno sin padre; registro de padre con `alumnoId` opcional para vincular.

### 4.1 Registrar padre/tutor

**`POST /personas/registro-padre`**  
Requiere: **JWT** + **Admin**.

**Body** (`application/json`):

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| `nombre` | string | Sí |
| `apellidoPaterno` | string | Sí |
| `apellidoMaterno` | string | Sí |
| `email` | string | Sí |
| `password` | string | Sí (mín. 6) |
| `telefono` | string | No |
| `fechaNacimiento` | string | No (YYYY-MM-DD) |
| `alumnoId` | number | No | ID del alumno a vincular. Si se envía, el padre queda asociado a ese alumno. |

**Respuesta 201:** Padre registrado. **Errores:** 401, 403 (no admin), 409 (email ya registrado).

---

### 4.2 Registrar alumno

**`POST /personas/registro-alumno`**  
Requiere: **JWT** + **Admin o Director**.

- **Admin**: puede registrar en cualquier escuela. Debe enviar `idEscuela`.
- **Director**: solo puede registrar en **su** escuela. **No tiene que enviar `idEscuela`**: si no lo envía, el backend usa automáticamente la escuela del director. Si lo envía, debe ser el ID de su propia escuela.

**Body** (`application/json`):

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `nombre` | string | Sí | |
| `apellidoPaterno` | string | Sí | |
| `apellidoMaterno` | string | Sí | |
| `email` | string | Sí | |
| `password` | string | Sí (mín. 6) | |
| `idEscuela` | number | Admin: Sí. Director: No (opcional) | ID de la escuela. Director no lo envía; se usa su escuela automáticamente. |
| `telefono` | string | No | |
| `fechaNacimiento` | string | No | YYYY-MM-DD |
| `grado` | number | No | Grado escolar |
| `grupo` | string | No | Ej. "A" |
| `cicloEscolar` | string | No | Ej. "2024-2025" |

**Respuesta 201:** Alumno registrado. El padre se vincula después con `POST /personas/registro-padre` (campo `alumnoId`).

**Errores:** 400 (admin no envió idEscuela), 401, 403 (no admin/director o director en otra escuela), 409 (email ya registrado).

**Paginación:** `GET /personas/alumnos?page=1&limit=20` (opcional).

---

### 4.3 Registrar maestro

**`POST /personas/registro-maestro`**  
Requiere: **JWT** + **Admin o Director**. Misma regla que alumno: director solo en su escuela.

**Body** (`application/json`):

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `nombre` | string | Sí | |
| `apellidoPaterno` | string | Sí | |
| `apellidoMaterno` | string | Sí | |
| `email` | string | Sí | |
| `password` | string | Sí (mín. 6) | |
| `idEscuela` | number | Admin: Sí. Director: No (opcional) | ID de la escuela. Director no lo envía; se usa su escuela. |
| `telefono` | string | No | |
| `fechaNacimiento` | string | No | YYYY-MM-DD |
| `especialidad` | string | No | Ej. "Matemáticas" |
| `fechaIngreso` | string | No | YYYY-MM-DD |

**Respuesta 201:** Maestro registrado.

**Errores:** 401, 403, 409.

---

### 4.4 Registrar director

**`POST /personas/registro-director`**  
Requiere: **JWT** + **Admin**.

**Body** (`application/json`):

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `nombre` | string | Sí | |
| `apellidoPaterno` | string | Sí | |
| `apellidoMaterno` | string | Sí | |
| `email` | string | Sí | |
| `password` | string | Sí (mín. 6) | |
| `idEscuela` | number | Sí | Escuela de la que será director (máx. 3 directores por escuela) |
| `telefono` | string | No | |
| `fechaNacimiento` | string | No | YYYY-MM-DD |
| `fechaNombramiento` | string | No | YYYY-MM-DD |

**Respuesta 201:** Director registrado.

**Errores:** 401, 403, 409 (email ya registrado o escuela ya tiene 3 directores).

---

### 4.5 Listar administradores

**`GET /personas/admins`**  
Requiere: **JWT** + **Admin**.

**Respuesta 200:**

```json
{
  "message": "Administradores obtenidos exitosamente",
  "description": "Se encontraron N administrador(es) en el sistema",
  "total": 3,
  "data": [
    {
      "idPersona": 1,
      "nombre": "Admin",
      "email": "admin@example.com",
      "tipoPersona": "administrador"
    }
  ]
}
```

---

### 4.6 Cantidad de administradores

**`GET /personas/admins/cantidad`**  
Requiere: **JWT** + **Admin**.

**Respuesta 200:**

```json
{
  "cantidad": 3,
  "maxAdmins": 5,
  "mensaje": "Puedes registrar 2 administrador(es) más"
}
```

---

### 4.7 Alumnos y Padres (GET)

#### Listar alumnos

**`GET /personas/alumnos`**  
**`GET /personas/alumnos?escuelaId=1`**  
**`GET /personas/alumnos?escuelaId=1&page=1&limit=20`**  
Requiere: **JWT** + **Admin o Director**.

- **Admin**: todos los alumnos; opcional `?escuelaId=X` para filtrar.
- **Director**: solo alumnos de su escuela.
- **Paginación**: `page` y `limit` opcionales.

Incluye `persona`, `escuela` y `padre` (si tiene).

#### Obtener alumno por ID

**`GET /personas/alumnos/:id`**  
Requiere: **JWT** + **Admin o Director**. Director solo alumnos de su escuela.

Incluye padre (si tiene).

#### Ver padre de un alumno

**`GET /personas/alumnos/:id/padre`**  
Requiere: **JWT** + **Admin o Director**.

Devuelve el padre del alumno, o `data: null` si no tiene.

#### Listar padres

**`GET /personas/padres`**  
**`GET /personas/padres?page=1&limit=20`**  
Requiere: **JWT** + **Admin**.

Lista todos los padres con sus alumnos. Paginación opcional (`page`, `limit`).

#### Obtener padre por ID

**`GET /personas/padres/:id`**  
Requiere: **JWT** + **Admin**.

Padre con sus alumnos.

#### Ver hijos de un padre

**`GET /personas/padres/:id/alumnos`**  
Requiere: **JWT** + **Admin**.

Lista de alumnos (hijos) del padre.

---

## 5. Escuelas

Todos los endpoints de escuelas requieren **JWT**. Según el endpoint, se exige **Admin** o **Admin o Director**. El director solo puede acceder a **su** escuela (mismo `id`).

### 5.1 Crear escuela

**`POST /escuelas`**  
Requiere: **JWT** + **Admin**.

**Body** (`application/json`):

| Campo | Tipo | Obligatorio | Límite |
|-------|------|-------------|--------|
| `nombre` | string | Sí | 150 caracteres |
| `nivel` | string | Sí | 50 (ej. "Primaria", "Secundaria") |
| `clave` | string | No | 50 |
| `direccion` | string | No | 200 |
| `telefono` | string | No | 20 |

**Respuesta 201:** Escuela creada con `id`, `nombre`, `nivel`, `clave`, `direccion`, `telefono`.

**Errores:** 401, 403, 409 (nombre o clave duplicada).

---

### 5.2 Listar todas las escuelas

**`GET /escuelas`**  
**`GET /escuelas?page=1&limit=20`**  
Requiere: **JWT** + **Admin**.

**Respuesta 200:** `{ message, description, total, data: [ ...escuelas ], meta?: { page, limit, total, totalPages } }`. Paginación opcional.

---

### 5.3 Obtener escuela por ID

**`GET /escuelas/:id`**  
Requiere: **JWT** + **Admin o Director**. Director solo si `id` es el de su escuela.

**Params:** `id` (number) – ID de la escuela.

**Respuesta 200:** Escuela con datos básicos y relaciones (ej. alumnos, maestros) según implementación.

**Errores:** 401, 403 (director de otra escuela), 404.

---

### 5.4 Actualizar escuela

**`PUT /escuelas/:id`**  
Requiere: **JWT** + **Admin**.

**Params:** `id` (number).

**Body** (`application/json`): todos los campos opcionales (solo enviar los que se actualizan).

| Campo | Tipo | Límite |
|-------|------|--------|
| `nombre` | string | 150 |
| `nivel` | string | 50 |
| `clave` | string | 50 |
| `direccion` | string | 200 |
| `telefono` | string | 20 |

**Respuesta 200:** Escuela actualizada.

**Errores:** 401, 403, 404, 409.

---

### 5.5 Eliminar escuela

**`DELETE /escuelas/:id`**  
Requiere: **JWT** + **Admin**.

**Params:** `id` (number).

**Respuesta 200:** Escuela eliminada.

**Errores:** 401, 403, 404, 400 (no se puede eliminar si tiene alumnos o maestros asociados).

---

### 5.6 Libros – Doble verificación

Un libro solo aparece en la escuela si: 1) Admin otorga. 2) Escuela canjea.

**Otorgar libro (Paso 1)** – `POST /escuelas/:id/libros`  
Requiere: **JWT** + **Admin**. Body: `{ "codigo": "LIB-..." }`. Crea pendiente. 409 si ya otorgado/canjeado.

**Canjear libro (Paso 2)** – `POST /escuelas/:id/libros/canjear`  
Requiere: **JWT** + **Admin o Director** (director solo su escuela). Body: `{ "codigo": "LIB-..." }`. 400 si admin no otorgó. 409 si ya canjeado.

**Ver pendientes** – `GET /escuelas/:id/libros/pendientes`  
Director: solo título y grado (sin código). Admin: información completa.

**Listar libros activos** – `GET /escuelas/:id/libros`  
Solo libros ya canjeados. Admin: cualquier escuela. Director: solo su escuela.

---

### 5.7 Mis libros (solo alumnos)

**`GET /escuelas/mis-libros`**  
Requiere: **JWT** + **Alumno**.

**Propósito:** Obtener los libros asignados a la escuela del alumno autenticado. Útil para mostrar la biblioteca digital del alumno.

**Respuesta 200:**

```json
{
  "message": "Libros obtenidos correctamente",
  "data": [
    {
      "id": 1,
      "titulo": "El principito",
      "grado": 5,
      "descripcion": "Libro de lectura",
      "codigo": "LIB-1735123456-abc12345"
    }
  ]
}
```

**Errores:** 401 (no autenticado), 403 (solo alumnos; si el usuario no es alumno o no tiene escuela asignada).

---

### 5.8 Listar maestros de la escuela

**`GET /escuelas/:id/maestros`**  
Requiere: **JWT** + **Admin o Director**. Director solo su escuela.

**Params:** `id` (number).

**Respuesta 200:** Lista de maestros de la escuela.

---

### 5.9 Listar alumnos de la escuela

**`GET /escuelas/:id/alumnos`**  
Requiere: **JWT** + **Admin o Director**. Director solo su escuela.

**Params:** `id` (number).

**Respuesta 200:** Lista de alumnos de la escuela.

---

### 5.10 Otorgar libro a la escuela (Paso 1)

**`POST /escuelas/:id/libros`**  
Requiere: **JWT** + **Admin**. Body: `{ "codigo": "LIB-..." }`. Crea pendiente; la escuela debe canjear después. **Errores:** 401, 403, 404, 409 (ya otorgado o canjeado). Ver [FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md).

---

## 6. Libros

Todos los endpoints de libros requieren **JWT**. Según el endpoint: **Admin** solo, o **Admin o Director**.

### 6.1 Cargar libro (PDF + metadatos)

**`POST /libros/cargar`**  
Requiere: **JWT** + **Admin**.

**Content-Type:** `multipart/form-data`.

**Campos del form:**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `pdf` | File | Sí | Archivo PDF (máx. 50 MB) |
| `titulo` | string | Sí | Título (máx. 150 caracteres) |
| `grado` | number | Sí | Grado escolar |
| `descripcion` | string | No | Máx. 255 |
| `codigo` | string | No | Si no se envía, el backend genera uno |
| `materiaId` | number | No | Opcional; libros de lectura suelen ir sin materia |

**Ejemplo (fetch):**

```js
const form = new FormData();
form.append('pdf', fileInput.files[0]);
form.append('titulo', 'El principito');
form.append('grado', 5);
form.append('descripcion', 'Libro de lectura');

const res = await fetch(`${BASE_URL}/libros/cargar`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: form,
});
```

**Respuesta 201:** Libro procesado y guardado (estado `listo`). Incluye `id`, `titulo`, `codigo`, `grado`, `descripcion`, `estado`, `numPaginas`, `rutaPdf`, `unidades`, etc. No hace falta otra llamada para “procesar”; mostrar “Procesando…” mientras dura la petición.

**Errores:** 400 (sin PDF, no es PDF, faltan titulo/grado, código duplicado), 401, 403.

---

### 6.2 Listar libros

**`GET /libros`**  
Requiere: **JWT** + **Admin**.

**Respuesta 200:**

```json
{
  "message": "Libros obtenidos correctamente.",
  "total": 2,
  "data": [
    {
      "id": 1,
      "titulo": "El principito",
      "materiaId": null,
      "codigo": "LIB-1735123456-abc12345",
      "grado": 5,
      "descripcion": "Libro de lectura",
      "estado": "listo",
      "numPaginas": 15,
      "materia": null
    }
  ]
}
```

Puede incluir `rutaPdf` si existe. Sirve para grids y listas.

---

### 6.3 Obtener libro por ID (unidades + segmentos)

**`GET /libros/:id`**  
Requiere: **JWT** + **Admin, Director o Alumno**.

- **Admin/Director:** Cualquier libro.
- **Alumno:** Solo libros asignados a su escuela. Si intenta acceder a un libro de otra escuela → 403.

**Params:** `id` (number) – ID del libro.

**Respuesta 200:** Libro con `unidades` (ordenadas por `orden`), cada una con `segmentos` (ordenados por `orden`). Cada segmento tiene `id`, `contenido` (texto), `numeroPagina`, `orden`, `idExterno` (UUID estable para progreso/analytics).

**Errores:** 401, 403 (alumno intentando libro de otra escuela), 404.

---

### 6.4 Descargar PDF del libro

**`GET /libros/:id/pdf`**  
Requiere: **JWT** + **Admin**. Solo administradores pueden descargar el PDF.

**Params:** `id` (number).

**Respuesta 200:** Cuerpo es el archivo PDF (`Content-Type: application/pdf`). Usar como descarga o abrir en nueva pestaña.

**Errores:** 401, 403 (no es administrador), 404 (libro no existe o no tiene PDF).

---

### 6.5 Eliminar libro

**`DELETE /libros/:id`**  
Requiere: **JWT** + **Admin**.

**Params:** `id` (number) – ID del libro.

**Propósito:** Elimina el libro por completo: asignaciones a escuelas (EscuelaLibro, EscuelaLibroPendiente), archivo PDF del disco, y en cascada las unidades y segmentos.

**Respuesta 200:** Libro eliminado.

**Errores:** 401, 403 (no es administrador), 404 (libro no encontrado).

---

## 7. Director

Dashboard exclusivo para directores de escuela. Requiere **JWT** + **Director**.

### 7.1 Dashboard del director

**`GET /director/dashboard`**  
Requiere: **JWT** + **Director**.

**Propósito:** Obtener estadísticas de la escuela del director autenticado: datos de la escuela, total de estudiantes, profesores y libros disponibles.

**Respuesta 200:**

```json
{
  "message": "Dashboard obtenido correctamente",
  "data": {
    "escuela": {
      "id": 1,
      "nombre": "Escuela Primaria Benito Juárez",
      "nivel": "Primaria",
      "clave": "29DPR0123X",
      "direccion": "Calle Principal #123",
      "telefono": "5551234567"
    },
    "totalEstudiantes": 120,
    "totalProfesores": 15,
    "librosDisponibles": 8
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `escuela` | Datos de la escuela del director |
| `totalEstudiantes` | Alumnos en su escuela |
| `totalProfesores` | Maestros en su escuela |
| `librosDisponibles` | Libros asignados y activos en su escuela |

**Errores:** 401 (no autenticado), 403 (solo directores).

---

## 8. Maestros

Todos los endpoints requieren **JWT** + **Maestro** (usuario autenticado debe ser maestro). El maestro solo ve/asigna alumnos de su contexto (misma escuela, asignación por materia).

### 8.1 Listar mis alumnos

**`GET /maestros/mis-alumnos`**  
Requiere: **JWT** + **Maestro**.

**Respuesta 200:** Lista de alumnos asignados al maestro (por materia).

**Errores:** 401, 403 (no es maestro).

---

### 8.2 Obtener un alumno por ID

**`GET /maestros/mis-alumnos/:id`**  
Requiere: **JWT** + **Maestro**. Solo si el alumno está asignado al maestro.

**Params:** `id` (number) – ID del alumno.

**Respuesta 200:** Datos del alumno.

**Errores:** 401, 403, 404 (alumno no encontrado o no asignado).

---

### 8.3 Asignar alumno a mi clase

**`POST /maestros/asignar-alumno`**  
Requiere: **JWT** + **Maestro**. El alumno debe ser de la misma escuela.

**Body** (`application/json`):

```json
{
  "alumnoId": 1,
  "materiaId": 1
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `alumnoId` | number | ID del alumno |
| `materiaId` | number | ID de la materia (clase) |

**Respuesta 201:** Alumno asignado.

**Errores:** 400 (datos inválidos), 401, 403 (maestro o alumno de otra escuela), 404 (alumno o materia no encontrados), 409 (alumno ya asignado en esta materia).

---

### 8.4 Desasignar alumno de mi clase

**`DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId`**  
Requiere: **JWT** + **Maestro**.

**Params:**  
- `alumnoId` (number)  
- `materiaId` (number)

**Respuesta 200:** Alumno desasignado.

**Errores:** 401, 403, 404 (asignación no encontrada).

---

## 9. Auditoría

Solo administradores pueden consultar los logs de auditoría.

### 9.1 Listar logs de auditoría

**`GET /audit`**  
**`GET /audit?page=1&limit=20`**  
Requiere: **JWT** + **Admin**.

**Respuesta 200:**

```json
{
  "message": "Logs de auditoría obtenidos correctamente",
  "total": 50,
  "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 },
  "data": [
    {
      "id": 1,
      "accion": "login",
      "usuarioId": 1,
      "ip": "192.168.1.1",
      "detalles": "admin@example.com",
      "fecha": "2025-02-04T12:00:00.000Z"
    }
  ]
}
```

**Acciones registradas:** `login`, `login_fallido`, `registro_admin`, `registro_padre`, `registro_alumno`, `registro_maestro`, `registro_director`, `escuela_crear`, `escuela_actualizar`, `escuela_eliminar`, `libro_cargar`, `libro_eliminar`.

Ver [AUDITORIA.md](./AUDITORIA.md) para más detalles.

---

## 10. Permisos por rol

| Recurso | Admin | Director | Maestro | Padre | Alumno |
|---------|-------|----------|---------|-------|--------|
| Login, `/`, `/health` | Público | Público | Público | Público | Público |
| Perfil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Director: GET /director/dashboard | ❌ | ✅ | ❌ | ❌ | ❌ |
| Personas: registro admin (máx 5) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Personas: registro padre/director | ✅ | ❌ | ❌ | ❌ | ❌ |
| Personas: registro alumno/maestro | ✅ | ✅ (solo su escuela) | ❌ | ❌ | ❌ |
| Escuelas: crear, listar, PUT, DELETE, otorgar libro, ver pendientes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Escuelas: GET :id, :id/libros, :id/libros/pendientes, :id/maestros, :id/alumnos | ✅ | ✅ (solo su escuela) | ❌ | ❌ | ❌ |
| Escuelas: GET mis-libros | ❌ | ❌ | ❌ | ❌ | ✅ (libros de su escuela) |
| Escuelas: POST :id/libros/canjear (canjear libro) | ✅ | ✅ (solo su escuela) | ❌ | ❌ | ❌ |
| Libros: cargar, listar, DELETE :id | ✅ | ❌ | ❌ | ❌ | ❌ |
| Libros: GET :id (detalle) | ✅ | ✅ | ❌ | ❌ | ✅ (solo libros de su escuela) |
| Libros: GET :id/pdf (descargar) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Maestros: mis-alumnos, asignar, desasignar | ❌ | ❌ | ✅ | ❌ | ❌ |
| Auditoría: GET /audit | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 11. Códigos de error

| Código | Significado | Acción sugerida en frontend |
|--------|-------------|-----------------------------|
| **400** | Bad Request (validación, datos inválidos) | Revisar body/params; mostrar mensaje del backend |
| **401** | No autenticado o token inválido/expirado | Redirigir a login; pedir nuevo `access_token` |
| **403** | Sin permiso (rol o recurso ajeno) | Mensaje “No tienes permiso” o “Solo para administradores/directores” |
| **404** | Recurso no encontrado | Mensaje “No encontrado” y/o volver al listado |
| **409** | Conflicto (duplicado: email, código, escuela con director, etc.) | Mostrar mensaje del backend; sugerir otro valor |

En respuestas de error el backend suele devolver un objeto con `message` y a veces `error`; usar `message` para mostrar al usuario.

---

## Resumen rápido para integración

1. **Login:** `POST /auth/login` con `{ email, password }` → guardar `access_token` y usarlo en `Authorization: Bearer <token>`.
2. **Registro admin:** Solo administradores pueden crear nuevos admins. `GET /personas/admins/cantidad` (con token admin) para ver cupo. `POST /auth/registro-admin` (con token admin). Máx. 5 admins.
3. **Libros:** Cargar con `POST /libros/cargar` (multipart: `pdf`, `titulo`, `grado`). Listar con `GET /libros`. Detalle y segmentos con `GET /libros/:id`. Descargar PDF con `GET /libros/:id/pdf` (solo admin). Eliminar con `DELETE /libros/:id` (solo admin).
4. **Escuelas:** CRUD con `/escuelas` (admin). Paginación: `?page=&limit=`. Libros: doble verificación (admin otorga, director canjea). Ver [FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md).
5. **Alumnos/Padres:** Paginación en `GET /personas/alumnos` y `GET /personas/padres` con `?page=&limit=`.
6. **Maestros:** `GET /maestros/mis-alumnos`, `POST /maestros/asignar-alumno` (`alumnoId`, `materiaId`), `DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId`.
7. **Auditoría:** `GET /audit` (solo admin) con `?page=&limit=`.

**Swagger** (solo en desarrollo): `http://localhost:3000/api`. Desactivado en producción.

---

*Última actualización: Febrero 2025. API Lector – Sistema Educativo. Ver [SEGURIDAD.md](./SEGURIDAD.md) para medidas de seguridad.*
