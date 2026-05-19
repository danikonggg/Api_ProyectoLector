# Panel de Administrador — Documentación completa de endpoints

> **Base URL:** `https://tu-api.render.com`
> **Auth:** `Authorization: Bearer <access_token>` en todos los endpoints marcados como protegidos.
> **Actualizado:** Mayo 2026

---

## Índice rápido

| Módulo | Endpoints |
|--------|-----------|
| [Auth](#1-autenticación) | login, refresh, primer-admin, registro-admin, forgot-password, reset-password, profile |
| [Admin — usuarios](#2-admin--usuarios-y-dashboard) | dashboard, listar usuarios, actualizar, eliminar |
| [Escuelas](#3-escuelas) | CRUD escuelas + libros por escuela + maestros/alumnos/directores por escuela + stats |
| [Libros](#4-libros) | cargar PDF, listar, activar/desactivar, escuelas de libro, eliminar, estado, imágenes |
| [Licencias](#5-licencias) | generar, listar, exportar PDF, canjear, activar/desactivar, archivar vencidas, eliminar |
| [Personas](#6-personas) | registro director/maestro/alumno/padre, listar admins, alumnos, padres, CRUD |
| [Materias](#7-materias) | CRUD completo |
| [Auditoría y Telemetría](#8-auditoría-y-telemetría) | logs, telemetría resumen/endpoints/roles/errores, conexiones |
| [Carga masiva](#9-carga-masiva) | plantilla Excel, carga masiva alumnos/maestros |

---

## 1. Autenticación

### POST /auth/login — Público
Iniciar sesión. Rate limit: **5 req/min por IP**.

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "tu_password",
  "rememberMe": true
}
```

| Campo | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| `email` | string | ✅ | — |
| `password` | string | ✅ | — |
| `rememberMe` | boolean | ❌ | `false` |

**Response 200:**
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "2d",
  "refresh_expires_in": "50d",
  "remember_me": true,
  "user": {
    "idPersona": 1,
    "nombre": "Juan",
    "email": "admin@example.com",
    "tipoPersona": "administrador"
  }
}
```

| Escenario | `expires_in` | `refresh_expires_in` |
|-----------|-------------|---------------------|
| `rememberMe: false` | 2 días | 2 días |
| `rememberMe: true` | 2 días | 50 días |

---

### POST /auth/refresh — Público
Renovar access token sin volver a poner contraseña. Rate limit: **20 req/min**.

**Body:**
```json
{ "refresh_token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response 200:**
```json
{
  "message": "Token renovado exitosamente",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "2d",
  "refresh_expires_in": "50d"
}
```

> ⚠️ Guarda el **nuevo** `refresh_token` que te devuelve — el anterior queda inválido.

---

### POST /auth/forgot-password — Público
Solicitar correo de recuperación. Rate limit: **3 req/min**. La respuesta es siempre la misma sin importar si el correo existe (seguridad anti-enumeración).

**Body:**
```json
{ "email": "usuario@example.com" }
```

**Response 200:**
```json
{
  "message": "Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña."
}
```

El enlace del correo tiene vigencia de **1 hora**.

---

### POST /auth/reset-password — Público
Usar el token del correo para cambiar la contraseña. Rate limit: **5 req/min**.

**Body:**
```json
{
  "token": "a3f8e2d1...",
  "nuevaPassword": "nuevaPassword123"
}
```

**Response 200:**
```json
{ "message": "Contraseña restablecida exitosamente." }
```

**Errores:**
- `400` — Token inválido o expirado

---

### POST /auth/primer-admin — Público
Crear el primer administrador del sistema. Solo funciona cuando **no hay ningún admin registrado**. Rate limit: 10 req/min.

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response 201:** Administrador creado.
**Error 409:** Ya existe al menos un administrador.

---

### POST /auth/registro-admin — Solo Admin
Crear otro administrador. Máximo **3 admins** en total.

**Body:**
```json
{
  "nombre": "María",
  "apellido": "García",
  "email": "maria@example.com",
  "password": "password123"
}
```

**Response 201:**
```json
{
  "message": "Administrador registrado exitosamente",
  "data": {
    "idPersona": 2,
    "nombre": "María",
    "email": "maria@example.com",
    "tipoPersona": "administrador"
  },
  "administrador": { "idAdmin": 2, "nivel": "normal" }
}
```

---

### GET /auth/profile — Cualquier autenticado
Datos del usuario que tiene el token activo.

**Response 200:**
```json
{
  "idPersona": 1,
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "admin@example.com",
  "tipoPersona": "administrador"
}
```

---

## 2. Admin — Usuarios y Dashboard

### GET /admin/dashboard — Solo Admin
Tarjetas del panel principal.

**Response 200:**
```json
{
  "message": "Dashboard obtenido correctamente",
  "data": {
    "escuelasActivas": 5,
    "totalEstudiantes": 120,
    "totalProfesores": 15,
    "librosDisponibles": 8
  }
}
```

---

### GET /admin/usuarios — Solo Admin
Todos los usuarios del sistema con totales por rol.

**Response 200:**
```json
{
  "message": "Usuarios obtenidos correctamente",
  "totalesPorRol": {
    "administrador": 2,
    "director": 5,
    "maestro": 15,
    "alumno": 120,
    "padre": 80,
    "total": 222
  },
  "total": 222,
  "data": [
    {
      "id": 1,
      "nombre": "Juan",
      "apellido": "Pérez",
      "correo": "admin@example.com",
      "telefono": null,
      "fechaNacimiento": "1990-05-15",
      "tipoPersona": "administrador",
      "activo": true
    }
  ]
}
```

---

### PATCH /admin/usuarios/:id — Solo Admin
Actualizar cualquier usuario (cualquier rol). **No se puede cambiar `tipoPersona`.**

**Params:** `id` — ID de la persona

**Body (todos opcionales):**
```json
{
  "nombre": "Juan Carlos",
  "apellido": "Pérez López",
  "correo": "nuevo@example.com",
  "telefono": "5559876543",
  "fechaNacimiento": "1990-05-15",
  "genero": "masculino",
  "password": "nuevoPassword123",
  "activo": true
}
```

**Response 200:** Usuario actualizado.
**Errores:** `404` no encontrado, `400` correo ya en uso.

---

### DELETE /admin/usuarios/:id — Solo Admin
Eliminar cualquier usuario del sistema.

**Params:** `id` — ID de la persona

**Response 200:**
```json
{ "message": "Usuario eliminado correctamente" }
```

---

## 3. Escuelas

### POST /escuelas — Solo Admin
Crear una nueva escuela.

**Body:**
```json
{
  "nombre": "Escuela Primaria Benito Juárez",
  "nivel": "Primaria",
  "clave": "29DPR0123X",
  "direccion": "Calle Principal #123",
  "telefono": "5551234567"
}
```

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `nombre` | string | ✅ |
| `nivel` | string | ✅ |
| `clave` | string | ❌ |
| `direccion` | string | ❌ |
| `telefono` | string | ❌ |

**Response 201:**
```json
{
  "message": "Escuela creada exitosamente",
  "data": { "id": 1, "nombre": "Escuela Primaria Benito Juárez", "nivel": "Primaria", ... }
}
```

---

### GET /escuelas — Solo Admin
Listar todas las escuelas con paginación.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Registros por página |

**Response 200:**
```json
{
  "message": "Escuelas obtenidas exitosamente",
  "total": 5,
  "data": [ { "id": 1, "nombre": "...", "nivel": "...", "clave": "..." } ]
}
```

---

### GET /escuelas/stats — Solo Admin
Tarjetas de resumen del panel de escuelas.

**Response 200:**
```json
{
  "message": "Estadísticas del panel de escuelas obtenidas correctamente",
  "data": {
    "totalEscuelas": 5,
    "escuelasActivas": 4,
    "totalAlumnos": 1840,
    "totalProfesores": 134,
    "licencias": 2000
  }
}
```

---

### GET /escuelas/directores — Solo Admin
Listar todos los directores del sistema con su escuela asignada.

**Query params:** `page`, `limit`

**Response 200:** Lista de directores con datos de persona y escuela.

---

### GET /escuelas/con-libros — Solo Admin
Todas las escuelas con los libros que tiene cada una.

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "nombre": "Escuela Benito Juárez",
      "libros": [
        { "id": 3, "titulo": "El principito", "activo": true }
      ]
    }
  ]
}
```

---

### GET /escuelas/lista — Admin o Director
Lista mínima `{id, nombre}` para usar en formularios/dropdowns.

**Response 200:**
```json
{ "data": [ { "id": 1, "nombre": "Escuela Benito Juárez" } ] }
```

---

### GET /escuelas/:id — Admin o Director
Obtener una escuela por ID. Director solo puede ver la suya.

**Response 200:**
```json
{
  "message": "Escuela obtenida exitosamente",
  "data": {
    "id": 1,
    "nombre": "Escuela Primaria Benito Juárez",
    "nivel": "Primaria",
    "clave": "29DPR0123X",
    "direccion": "Calle Principal #123",
    "telefono": "5551234567",
    "alumnos": [],
    "maestros": []
  }
}
```

---

### PUT /escuelas/:id — Solo Admin
Actualizar datos de una escuela.

**Body:** Mismos campos que el POST (todos opcionales).

**Response 200:** Escuela actualizada.
**Errores:** `404`, `409` clave/nombre duplicado.

---

### DELETE /escuelas/:id — Solo Admin
Eliminar escuela. Falla si tiene alumnos o maestros asociados.

**Response 200:** Escuela eliminada.
**Error 400:** Tiene usuarios asociados, debe eliminarlos primero.

---

### GET /escuelas/:id/libros — Solo Admin
Libros activos asignados a la escuela.

---

### GET /escuelas/:id/libros/asignaciones — Solo Admin
Todas las asignaciones libro-escuela (activas e inactivas). Útil para el panel de gestión de libros por escuela.

**Response 200:**
```json
{
  "data": [
    {
      "libroId": 3,
      "titulo": "El principito",
      "activoEnEscuela": true,
      "activoGlobal": true
    }
  ]
}
```

---

### PATCH /escuelas/:id/libros/:libroId/activo — Solo Admin
Activar o desactivar un libro solo en esta escuela (sin afectar otras escuelas).

**Body:**
```json
{ "activo": false }
```

---

### GET /escuelas/:id/maestros — Admin o Director
Maestros de la escuela. Director solo puede ver la suya.

---

### GET /escuelas/:id/alumnos — Admin o Director
Alumnos de la escuela. Director solo puede ver la suya.

---

### GET /escuelas/:id/directores — Admin o Director
Directores de la escuela. Director solo puede ver la suya.

---

### GET /escuelas/alumnos/:alumnoId/libros — Admin o Director
Ver libros asignados a un alumno específico con su progreso. Director solo puede consultar alumnos de su escuela.

---

## 4. Libros

### POST /libros/cargar — Solo Admin
Subir un libro en PDF. El backend extrae el texto, lo limpia y lo segmenta automáticamente. Rate limit: **10 req/min**.

**Content-Type:** `multipart/form-data`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `pdf` | file | ✅ | Archivo PDF (máx 50 MB) |
| `titulo` | string | ✅ | Nombre del libro |
| `grado` | number | ✅ | Grado escolar (1-6 ej.) |
| `codigo` | string | ❌ | Código interno |
| `descripcion` | string | ❌ | Descripción del libro |
| `materiaId` | number | ❌ | ID de materia |

**Response 201:**
```json
{
  "message": "Libro procesado y guardado",
  "data": {
    "id": 5,
    "titulo": "El principito",
    "grado": 4,
    "totalSegmentos": 12,
    "estado": "listo"
  }
}
```

---

### GET /libros — Solo Admin
Listar todos los libros con paginación.

**Query params:** `page` (default 1), `limit` (default 50)

**Response 200:** Lista con meta de paginación.

---

### GET /libros/:id — Admin, Director o Alumno
Obtener libro con todas sus unidades y segmentos. Alumnos solo ven libros que les fueron asignados.

---

### GET /libros/:id/estado — Solo Admin
Estado de procesamiento del libro (útil si el procesamiento es asíncrono).

**Response 200:**
```json
{
  "data": {
    "estado": "listo",
    "mensajeError": null,
    "jobId": null
  }
}
```

---

### GET /libros/:id/pdf — Solo Admin
Descarga el PDF original. Devuelve un redirect a la URL del archivo.

---

### GET /libros/:id/paginas/:numero/imagen — Admin, Director o Alumno
Imagen PNG de una página específica del libro.

**Params:** `id` = libroId, `numero` = número de página (1, 2, 3...)

**Response 200:** Imagen PNG (Content-Type: image/png).

---

### GET /libros/:id/escuelas — Solo Admin
Escuelas que tienen este libro asignado, con `activoEnEscuela`. Útil para gestionar desde la pantalla del libro.

**Response 200:**
```json
{
  "data": [
    { "escuelaId": 1, "nombre": "Escuela Benito Juárez", "activoEnEscuela": true }
  ]
}
```

---

### PATCH /libros/:id/escuelas/:escuelaId/activo — Solo Admin
Activar/desactivar este libro en una escuela específica (desde la pantalla del libro, alternativa a hacerlo desde la pantalla de la escuela).

**Body:** `{ "activo": true }`

---

### PATCH /libros/:id/activo — Solo Admin
Activar o desactivar el libro **globalmente**. Si se desactiva, se desactiva en todas las escuelas automáticamente.

**Body:** `{ "activo": false }`

---

### DELETE /libros/:id — Solo Admin
Eliminar el libro por completo: asignaciones, PDF, unidades y segmentos.

---

### POST /libros/glosario/palabra — Cualquier autenticado
Registrar una palabra en el glosario global. Rate limit: 30 req/min.

**Body:**
```json
{ "palabra": "fotosíntesis" }
```

**Response 200:**
```json
{
  "palabra": "fotosíntesis",
  "definicion": "Proceso por el cual las plantas convierten la luz solar en energía...",
  "origen": "cache"
}
```

`origen` puede ser `"cache"` (ya estaba en BD) o `"remoto"` (se buscó y guardó ahora).

---

## 5. Licencias

### POST /licencias/generar — Solo Admin
Generar un lote de licencias para una escuela y libro.

**Body:**
```json
{
  "escuelaId": 1,
  "libroId": 3,
  "cantidad": 50,
  "fechaVencimiento": "2026-12-31"
}
```

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `escuelaId` | number | ✅ |
| `libroId` | number | ✅ |
| `cantidad` | number | ✅ |
| `fechaVencimiento` | string (ISO date) | ❌ |

**Response 201:** Licencias generadas con sus claves.

---

### GET /licencias — Solo Admin
Listar licencias con filtros.

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `escuelaId` | number | Filtrar por escuela |
| `libroId` | number | Filtrar por libro |
| `estado` | string | `disponible` / `usada` / `vencida` / `desactivada` / `baja` |
| `page` | number | Página |
| `limit` | number | Registros por página |

---

### GET /licencias/escuela/:id — Admin o Director
Licencias de una escuela específica. Director solo puede ver la suya.

**Query params:** `libroId`, `estado`, `page`, `limit`

---

### GET /licencias/escuela/:id/totales — Admin o Director
Totales de licencias por escuela y desglose por libro.

**Response 200:**
```json
{
  "data": {
    "total": 200,
    "disponibles": 80,
    "usadas": 100,
    "vencidas": 20,
    "porLibro": [
      { "libroId": 3, "titulo": "El principito", "disponibles": 40, "usadas": 60 }
    ]
  }
}
```

---

### GET /licencias/exportar-pdf — Solo Admin
Exportar licencias a PDF para imprimir o entregar. Devuelve el archivo directamente.

**Query params:**

| Param | Requerido | Descripción |
|-------|-----------|-------------|
| `escuelaId` | ✅ | ID de la escuela |
| `libroId` | ❌ | Filtrar por libro |
| `estado` | ❌ | `disponible` / `usada` / `vencida` |

**Response 200:** Archivo PDF (Content-Disposition: attachment).

---

### POST /licencias/archivar-vencidas — Solo Admin
Mover licencias vencidas a la tabla histórica. No aparecen en listados normales.

**Body:**
```json
{ "escuelaId": 1, "libroId": 3 }
```

---

### DELETE /licencias/:id — Solo Admin
Eliminar una licencia disponible (ej. fue generada por error). No se puede eliminar si ya fue canjeada.

**Error 400:** La licencia ya fue canjeada.

---

### POST /licencias/eliminar-disponibles — Solo Admin
Eliminar licencias disponibles en lote con filtros opcionales.

**Body (todos opcionales):**
```json
{
  "escuelaId": 1,
  "libroId": 3,
  "cantidad": 10
}
```
Sin filtros = elimina **todas** las disponibles del sistema.

---

### PATCH /licencias/:id/activa — Solo Admin
Activar o desactivar una licencia específica.

**Body:** `{ "activa": false }`

---

## 6. Personas

### POST /personas/registro-director — Solo Admin
Registrar un director y asignarlo a una escuela.

**Body:**
```json
{
  "nombre": "Carlos",
  "apellido": "Ramírez",
  "email": "carlos@escuela.com",
  "password": "password123",
  "escuelaId": 1
}
```

---

### POST /personas/registro-maestro — Admin o Director
Registrar un maestro en una escuela.

**Body:**
```json
{
  "nombre": "Ana",
  "apellido": "López",
  "email": "ana@escuela.com",
  "password": "password123",
  "escuelaId": 1
}
```

Director solo puede registrar maestros en su propia escuela.

---

### POST /personas/registro-alumno — Admin o Director
Registrar un alumno en una escuela.

**Body:**
```json
{
  "nombre": "Pedro",
  "apellidoPaterno": "Hernández",
  "apellidoMaterno": "Cruz",
  "email": "pedro@escuela.com",
  "password": "password123",
  "escuelaId": 1,
  "grado": 5,
  "grupo": "A"
}
```

---

### POST /personas/registro-padre — Solo Admin
Registrar un padre/tutor.

**Body:**
```json
{
  "nombre": "Roberto",
  "apellido": "Hernández",
  "email": "roberto@email.com",
  "password": "password123"
}
```

---

### POST /personas/registro-padre-con-hijo — Solo Admin
Registrar un padre y un alumno al mismo tiempo (ya quedan vinculados).

**Body:**
```json
{
  "padre": {
    "nombre": "Roberto",
    "apellido": "Hernández",
    "email": "roberto@email.com",
    "password": "password123"
  },
  "alumno": {
    "nombre": "Pedro",
    "apellidoPaterno": "Hernández",
    "email": "pedro@escuela.com",
    "password": "password123",
    "escuelaId": 1
  }
}
```

---

### GET /personas/admins — Solo Admin
Listar todos los administradores registrados.

---

### GET /personas/admins/cantidad — Solo Admin
Cuántos administradores hay registrados (número simple).

---

### GET /personas/alumnos — Admin o Director
Listar alumnos. Admin ve todos; Director solo los de su escuela.

**Query params:** `page`, `limit`, `escuelaId` (solo admin)

---

### GET /personas/alumnos/buscar — Admin o Director
Buscar alumnos por nombre, apellido o correo.

**Query params:** `q` (término de búsqueda)

---

### GET /personas/alumnos/:id — Admin o Director
Obtener alumno por ID con datos del padre si tiene.

---

### PATCH /personas/alumnos/:id — Admin o Director
Actualizar datos de un alumno. Director solo puede modificar alumnos de su escuela.

---

### DELETE /personas/alumnos/:id — Admin o Director
Eliminar alumno. Director solo puede eliminar alumnos de su escuela.

---

### PATCH /personas/maestros/:id — Admin o Director
Actualizar datos de un maestro.

---

### DELETE /personas/maestros/:id — Admin o Director
Eliminar maestro. Director solo puede eliminar maestros de su escuela.

---

### GET /personas/padres — Solo Admin
Listar todos los padres/tutores del sistema.

---

### GET /personas/padres/:id — Padre o Admin
Ver datos de un padre con sus hijos/alumnos vinculados. Un padre solo puede ver sus propios datos.

---

### GET /personas/padres/:id/alumnos — Padre o Admin
Ver los alumnos vinculados a un padre.

---

## 7. Materias

Todas las rutas de materias requieren autenticación. No tienen restricción de rol específica (cualquier autenticado puede listar/leer, operaciones de escritura requieren admin implícitamente).

### GET /materias
Listar todas las materias.

**Response 200:**
```json
{
  "data": [
    { "id": 1, "nombre": "Español", "descripcion": "..." }
  ]
}
```

---

### GET /materias/:id
Obtener materia por ID.

---

### POST /materias — Solo Admin
Crear materia.

**Body:**
```json
{ "nombre": "Español", "descripcion": "..." }
```

---

### PATCH /materias/:id — Solo Admin
Actualizar materia.

---

### DELETE /materias/:id — Solo Admin
Eliminar materia.

---

## 8. Auditoría y Telemetría

Todos los endpoints de `/audit` requieren **Solo Admin**.

### GET /audit
Logs de auditoría (acciones de usuarios: logins, registros, etc.). Paginado.

**Query params:** `page`, `limit`

**Response 200:**
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
      "fecha": "2026-05-19T12:00:00.000Z"
    }
  ]
}
```

---

### GET /audit/telemetry/resumen
Métricas generales de las últimas 24h y 7 días: total de peticiones, errores, tasa de error y tiempo promedio de respuesta.

**Response 200:**
```json
{
  "data": {
    "ultimas24h": {
      "totalPeticiones": 340,
      "totalErrores": 12,
      "tasaError": 3.53,
      "tiempoPromedioMs": 145
    },
    "ultimos7d": {
      "totalPeticiones": 2100,
      "totalErrores": 67,
      "tasaError": 3.19,
      "tiempoPromedioMs": 138
    }
  }
}
```

---

### GET /audit/telemetry/endpoints
Top 30 endpoints más llamados con estadísticas de errores y tiempos.

**Query params:**

| Param | Default | Descripción |
|-------|---------|-------------|
| `dias` | `7` | Rango de días hacia atrás |

**Response 200:**
```json
{
  "data": [
    {
      "method": "POST",
      "path": "/auth/login",
      "total": 450,
      "errores": 15,
      "tasaError": 3.33,
      "tiempoPromedioMs": 210,
      "tiempoMaxMs": 890
    }
  ]
}
```

---

### GET /audit/telemetry/roles
Actividad agrupada por rol de usuario.

**Query params:** `dias` (default 7)

**Response 200:**
```json
{
  "data": [
    {
      "tipoPersona": "alumno",
      "totalAcciones": 1200,
      "tiempoPromedioMs": 120
    },
    {
      "tipoPersona": "maestro",
      "totalAcciones": 300,
      "tiempoPromedioMs": 135
    },
    {
      "tipoPersona": "administrador",
      "totalAcciones": 80,
      "tiempoPromedioMs": 200
    }
  ]
}
```

---

### GET /audit/telemetry/errores
Peticiones que devolvieron status ≥ 400, ordenadas por fecha desc. Paginado.

**Query params:** `page` (default 1), `limit` (default 20)

**Response 200:**
```json
{
  "meta": { "page": 1, "limit": 20, "total": 67 },
  "data": [
    {
      "id": 901,
      "method": "POST",
      "path": "/auth/login",
      "statusCode": 401,
      "durationMs": 88,
      "tipoPersona": null,
      "ip": "189.x.x.x",
      "fecha": "2026-05-19T14:22:00.000Z"
    }
  ]
}
```

---

### GET /audit/conexiones/metricas
Métricas de conexión por períodos. Muestra cuántos usuarios se conectaron en las últimas 24h, 48h, 7d y 30d, y cuántos nunca se han conectado o llevan más de X días sin hacerlo.

**Response 200:**
```json
{
  "data": {
    "conectados": {
      "ultimas24h": 45,
      "ultimas48h": 80,
      "ultimos7d": 190,
      "ultimos30d": 310
    },
    "sinConexion": {
      "nunca": 25,
      "masDe7dias": 60,
      "masDe30dias": 15
    },
    "porRol": {
      "alumno": { "ultimas24h": 38, "nunca": 20 },
      "maestro": { "ultimas24h": 5, "nunca": 3 },
      "director": { "ultimas24h": 2, "nunca": 2 }
    }
  }
}
```

---

### GET /audit/conexiones
Últimas conexiones (eventos de login), paginadas. Ordenadas por fecha desc.

**Query params:** `page`, `limit`

**Response 200:**
```json
{
  "meta": { "page": 1, "limit": 20, "total": 500 },
  "data": [
    {
      "usuarioId": 15,
      "nombre": "Pedro Hernández",
      "tipoPersona": "alumno",
      "ip": "189.x.x.x",
      "fecha": "2026-05-19T10:30:00.000Z"
    }
  ]
}
```

---

## 9. Carga masiva

### GET /escuelas/plantilla-carga-masiva — Público
Descarga un Excel vacío con las columnas esperadas para carga masiva.

**Response 200:** Archivo `.xlsx` (Content-Disposition: attachment).

**Columnas del Excel:**

| Columna | Requerida | Descripción |
|---------|-----------|-------------|
| `nombre` | ✅ | Nombre del usuario |
| `email` (o `correo`) | ✅ | Correo |
| `apellidoPaterno` | ❌ | Apellido paterno |
| `apellidoMaterno` | ❌ | Apellido materno |
| `password` | ❌ | Si no se envía, se genera automáticamente |
| `grado` | ❌ | Solo para alumnos |
| `grupo` | ❌ | Solo para alumnos |

---

### POST /escuelas/:id/carga-masiva — Admin o Director
Subir el Excel para registrar alumnos o maestros en lote. Director solo puede hacerlo en su propia escuela.

**Content-Type:** `multipart/form-data`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `file` | file | ✅ | Archivo Excel `.xlsx` (máx 5 MB) |
| `tipo` | string | ✅ | `"alumno"` o `"maestro"` |

**Response 200:**
```json
{
  "message": "Carga masiva completada. Creados: 45, errores: 2",
  "creados": 45,
  "totalErrores": 2,
  "credenciales": [
    { "nombre": "Pedro Hernández", "email": "pedro@escuela.com", "password": "auto_abc123" }
  ],
  "detalleErrores": [
    { "fila": 5, "error": "El correo ya existe en el sistema" }
  ],
  "excelBase64": "UEsDBBQAAAAIA..."
}
```

> 💡 `excelBase64` es el archivo Excel de credenciales en base64. Decodifícalo y ofrécelo como descarga para que el admin tenga las contraseñas generadas automáticamente.

**Ejemplo de descarga del Excel en JS:**
```javascript
const bytes = atob(response.excelBase64);
const buffer = new ArrayBuffer(bytes.length);
const view = new Uint8Array(buffer);
for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'credenciales.xlsx';
a.click();
```

---

## Resumen de permisos por rol

| Endpoint | Admin | Director | Maestro | Alumno | Público |
|----------|-------|----------|---------|--------|---------|
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/refresh | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/forgot-password | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /auth/profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /auth/registro-admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /admin/dashboard | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /admin/usuarios | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /escuelas | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /escuelas | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /escuelas/:id | ✅ | ✅ (solo la suya) | ❌ | ❌ | ❌ |
| PUT /escuelas/:id | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /escuelas/:id/maestros | ✅ | ✅ (solo la suya) | ❌ | ❌ | ❌ |
| POST /escuelas/:id/carga-masiva | ✅ | ✅ (solo la suya) | ❌ | ❌ | ❌ |
| POST /licencias/generar | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /licencias/escuela/:id | ✅ | ✅ (solo la suya) | ❌ | ❌ | ❌ |
| POST /personas/registro-director | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /personas/registro-alumno | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /audit/* | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Códigos de error comunes

| Código | Cuándo |
|--------|--------|
| `400` | Body inválido, campo faltante o lógica de negocio fallida |
| `401` | Token faltante, inválido o expirado |
| `403` | Autenticado pero sin permiso (ej. director intentando ver otra escuela) |
| `404` | Recurso no encontrado |
| `409` | Conflicto: email duplicado, clave duplicada, límite alcanzado |
| `422` | Validación de tipos fallida (campo no es número cuando debe serlo, etc.) |
| `429` | Rate limit superado |

---

*Documentación del Panel de Administrador — Proyecto Lector | Mayo 2026*
