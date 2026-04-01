# Documentación completa: Panel de Administrador

Documento unificado para el administrador de la API Lector.

---

## Inicio de sesión (Login) – primer paso para el panel admin

Para acceder al panel de administrador **el primer paso es hacer login** y obtener el token JWT. Sin el token no podrás usar ningún otro endpoint.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Iniciar sesión y obtener token |

**Body (JSON):**
```json
{
  "email": "admin@example.com",
  "password": "tu_password"
}
```

**Respuesta 200:**
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "24h",
  "user": {
    "idPersona": 1,
    "nombre": "Juan",
    "email": "admin@example.com",
    "tipoPersona": "administrador"
  }
}
```

Usa el `access_token` en todas las peticiones al API:

```
Authorization: Bearer <access_token>
```

---

## Índice

0. [Login (inicio de sesión)](#inicio-de-sesión-login--primer-paso-para-el-panel-admin)
1. [Autenticación](#1-autenticación)
2. [Admin: Dashboard y usuarios](#2-admin-dashboard-y-usuarios)
3. [Escuelas](#3-escuelas)
4. [Libros](#4-libros)
5. [Licencias](#5-licencias)
6. [Personas (registro por rol)](#6-personas-registro-por-rol)
7. [Auditoría](#7-auditoría)
8. [Carga masiva](#8-carga-masiva)

---

## 1. Autenticación

### POST /auth/login (Público)

**Body (JSON):**

| Campo     | Tipo   | Obligatorio | Descripción                 |
|-----------|--------|-------------|-----------------------------|
| email     | string | Sí          | Correo del usuario          |
| password  | string | Sí          | Contraseña (mín. 6 caracteres) |

**Ejemplo:**
```json
{
  "email": "admin@example.com",
  "password": "tu_password"
}
```

**Respuesta 200:**
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "24h",
  "user": {
    "idPersona": 1,
    "nombre": "Juan",
    "email": "admin@example.com",
    "tipoPersona": "administrador"
  }
}
```

---

### POST /auth/registro-admin (Solo Admin)

Registrar otro administrador. Máximo 5 en total.

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Descripción                    |
|-----------------|--------|-------------|--------------------------------|
| nombre          | string | Sí          | Nombre (máx. 100)              |
| apellidoPaterno | string | Sí          | Apellido paterno               |
| apellidoMaterno | string | Sí          | Apellido materno               |
| email           | string | Sí          | Correo único                   |
| password        | string | Sí          | Mín. 6 caracteres              |
| telefono        | string | No          | Teléfono (máx. 20)             |
| fechaNacimiento | string | No          | YYYY-MM-DD                     |
| nivel           | string | No          | Ej: "super", "normal"          |

**Ejemplo:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "admin2@example.com",
  "password": "password123",
  "telefono": "5551234567",
  "fechaNacimiento": "1990-05-15",
  "nivel": "normal"
}
```

**Respuesta 201:**
```json
{
  "message": "Administrador registrado exitosamente",
  "description": "El administrador ha sido creado correctamente. Total de administradores: 4/5",
  "data": {
    "idPersona": 1,
    "nombre": "Juan",
    "email": "admin2@example.com",
    "tipoPersona": "administrador"
  },
  "administrador": {
    "idAdmin": 1,
    "nivel": "normal"
  }
}
```

---

### GET /auth/profile

Obtener perfil del usuario autenticado. Requiere JWT.

---

## 2. Admin: Dashboard y usuarios

### GET /admin/dashboard

Estadísticas del panel de administrador.

**Respuesta 200:**
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

### GET /admin/usuarios

Lista todos los usuarios del sistema con totales por rol.

**Respuesta 200:**
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
      "activo": true,
      "rolId": 1
    }
  ]
}
```

---

### PATCH /admin/usuarios/:id

Actualizar un usuario por ID de persona. **No cambia el rol.** Todos los campos son opcionales.

**Body (JSON):**

| Campo           | Tipo    | Obligatorio | Descripción                     |
|-----------------|---------|-------------|---------------------------------|
| nombre          | string  | No          | Nombre (máx. 100)               |
| apellidoPaterno | string  | No          | Apellido paterno                |
| apellidoMaterno | string  | No          | Apellido materno                |
| correo          | string  | No          | Correo (único si se cambia)     |
| telefono        | string  | No          | Teléfono (máx. 20)              |
| fechaNacimiento | string  | No          | YYYY-MM-DD                      |
| genero          | string  | No          | Género (máx. 30)                |
| password        | string  | No          | Nueva contraseña (mín. 6)       |
| activo          | boolean | No          | Usuario activo o no             |

**Ejemplo:**
```json
{
  "nombre": "Juan Carlos",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "correo": "juan.nuevo@example.com",
  "telefono": "5559998877",
  "fechaNacimiento": "1985-03-20",
  "genero": "M",
  "activo": true
}
```

---

### DELETE /admin/usuarios/:id

Eliminar un usuario por ID de persona.

**Sin body.** Respuesta 200 con mensaje de éxito.

---

## 3. Escuelas

### POST /escuelas

Crear escuela.

**Body (JSON):**

| Campo        | Tipo   | Obligatorio | Descripción                             |
|--------------|--------|-------------|-----------------------------------------|
| nombre       | string | Sí          | Nombre (máx. 150)                       |
| nivel        | string | Sí          | Nivel educativo (máx. 50), ej: "Primaria" |
| clave        | string | No          | Clave escuela (máx. 50)                 |
| direccion    | string | No          | Dirección (máx. 200)                    |
| telefono     | string | No          | Teléfono (máx. 20)                      |
| estado       | string | No          | `activa` \| `suspendida` \| `inactiva`  |
| ciudad       | string | No          | Ciudad (máx. 100)                       |
| estadoRegion | string | No          | Estado o región (máx. 100)              |

**Ejemplo:**
```json
{
  "nombre": "Escuela Primaria Benito Juárez",
  "nivel": "Primaria",
  "clave": "29DPR0123X",
  "direccion": "Calle Principal #123, Col. Centro",
  "telefono": "5551234567",
  "estado": "activa",
  "ciudad": "Ciudad de México",
  "estadoRegion": "CDMX"
}
```

**Respuesta 201:**
```json
{
  "message": "Escuela creada exitosamente",
  "description": "La escuela ha sido registrada correctamente en el sistema.",
  "data": {
    "id": 1,
    "nombre": "Escuela Primaria Benito Juárez",
    "nivel": "Primaria",
    "clave": "29DPR0123X",
    "direccion": "Calle Principal #123",
    "telefono": "5551234567"
  }
}
```

---

### GET /escuelas

Listar todas las escuelas. Query params opcionales: `page`, `limit`.

**Ejemplo:** `GET /escuelas?page=1&limit=20`

**Respuesta 200:**
```json
{
  "message": "Escuelas obtenidas exitosamente",
  "total": 5,
  "data": [
    {
      "id": 1,
      "nombre": "Escuela Primaria Benito Juárez",
      "nivel": "Primaria",
      "clave": "29DPR0123X",
      "direccion": "Calle Principal #123",
      "telefono": "5551234567"
    }
  ]
}
```

---

### GET /escuelas/stats

Estadísticas del panel de escuelas.

**Respuesta 200:**
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

### GET /escuelas/directores

Listar todos los directores con su escuela. Query: `page`, `limit` (opcionales).

---

### GET /escuelas/con-libros

Listar escuelas con los libros asignados a cada una.

---

### GET /escuelas/:id

Detalle de una escuela.

**Respuesta 200:**
```json
{
  "message": "Escuela obtenida exitosamente",
  "description": "La escuela fue encontrada en el sistema",
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

### PUT /escuelas/:id

Actualizar escuela. Todos los campos son opcionales.

**Body (JSON):** mismos campos que POST /escuelas, todos opcionales.

**Ejemplo:**
```json
{
  "nombre": "Escuela Primaria Benito Juárez Actualizada",
  "nivel": "Primaria",
  "clave": "29DPR0123X",
  "direccion": "Nueva Dirección #456",
  "telefono": "5551234567",
  "estado": "activa"
}
```

---

### DELETE /escuelas/:id

Eliminar escuela. Devuelve 400 si tiene alumnos o maestros asociados.

---

### GET /escuelas/:id/libros

Libros activos de la escuela.

---

### GET /escuelas/:id/libros/asignaciones

Todas las asignaciones libro-escuela (activas e inactivas) para activar/desactivar.

---

### PATCH /escuelas/:id/libros/:libroId/activo

Activar o desactivar un libro en esa escuela.

**Body (JSON):**
```json
{ "activo": true }
```
o
```json
{ "activo": false }
```

---

### GET /escuelas/:id/maestros
### GET /escuelas/:id/alumnos
### GET /escuelas/:id/directores

Listar maestros, alumnos o directores de la escuela.

---

## 4. Libros

### POST /libros/cargar

Cargar libro (PDF + metadatos). **Content-Type: multipart/form-data.** Máx. 50 MB.

**FormData (campos):**

| Campo       | Tipo   | Obligatorio | Descripción                    |
|-------------|--------|-------------|--------------------------------|
| pdf         | File   | Sí          | Archivo PDF                    |
| titulo      | string | Sí          | Título (máx. 150)              |
| grado       | number | Sí          | Grado 1-9                      |
| codigo      | string | No          | Código (máx. 50)               |
| descripcion | string | No          | Descripción (máx. 255)         |
| materiaId   | number | No          | ID de materia                  |

**Ejemplo FormData:**
- `pdf`: archivo PDF
- `titulo`: "El principito"
- `grado`: 5
- `codigo`: "LECT-2024"
- `descripcion`: "Libro de lectura para quinto grado"

**Respuesta 201:**
```json
{
  "message": "Libro cargado correctamente",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "codigo": "LECT-2024",
    "grado": 5,
    "estado": "listo",
    "activo": true
  }
}
```

---

### GET /libros

Listar libros con paginación. Query: `page` (default 1), `limit` (default 50, máx. 100).

**Ejemplo:** `GET /libros?page=1&limit=50`

---

### GET /libros/:id

Detalle del libro con unidades y segmentos.

---

### GET /libros/:id/pdf

Descargar el PDF del libro. La respuesta es el archivo binario (`Content-Type: application/pdf`).

---

### GET /libros/:id/escuelas

Ver escuelas que tienen este libro (con `activoEnEscuela`).

---

### PATCH /libros/:id/escuelas/:escuelaId/activo

Activar o desactivar este libro en una escuela.

**Body (JSON):**
```json
{ "activo": true }
```
o
```json
{ "activo": false }
```

---

### PATCH /libros/:id/activo

Activar o desactivar el libro globalmente.

**Body (JSON):**
```json
{ "activo": true }
```
o
```json
{ "activo": false }
```

---

### DELETE /libros/:id

Eliminar libro por completo (asignaciones, PDF, unidades, segmentos).

---

## 5. Licencias

Las licencias son **individuales por alumno**. Cada licencia = 1 alumno. El admin genera claves; la escuela las reparte; el alumno canjea su clave.

### POST /licencias/generar

Generar un lote de licencias.

**Body (JSON):**

| Campo            | Tipo   | Obligatorio | Descripción                     |
|------------------|--------|-------------|---------------------------------|
| escuelaId        | number | Sí          | ID de la escuela                |
| libroId          | number | Sí          | ID del libro                    |
| cantidad         | number | Sí          | 1-1000                          |
| fechaVencimiento | string | Sí          | YYYY-MM-DD (ISO 8601)           |

**Ejemplo:**
```json
{
  "escuelaId": 1,
  "libroId": 1,
  "cantidad": 50,
  "fechaVencimiento": "2025-06-30"
}
```

**Respuesta 201:**
```json
{
  "message": "Se generaron 50 licencias correctamente.",
  "description": "Libro \"El principito\". Escuela: ... . Vencimiento: 2025-06-30.",
  "data": {
    "escuelaId": 1,
    "libroId": 1,
    "titulo": "El principito",
    "cantidad": 50,
    "fechaVencimiento": "2025-06-30",
    "claves": ["LECT-A1B2-C3D4-E5F6", "LECT-X7Y8-Z9W2-Q4R5", "..."  ]
  }
}
```

Las claves en `data.claves` se entregan a la escuela. Cada alumno canjea su clave con `POST /licencias/canjear`.

---

### GET /licencias

Listar licencias con filtros. Query params (todos opcionales):

| Param      | Tipo   | Valores                    | Descripción         |
|------------|--------|----------------------------|---------------------|
| escuelaId  | number | ID                         | Filtrar por escuela |
| libroId    | number | ID                         | Filtrar por libro   |
| estado     | string | `disponible`, `usada`, `vencida` | Filtrar por estado  |

**Ejemplo:** `GET /licencias?escuelaId=1&estado=disponible`

**Respuesta 200:**
```json
{
  "message": "Licencias obtenidas correctamente.",
  "total": 50,
  "data": [
    {
      "id": 1,
      "clave": "LECT-A1B2-C3D4-E5F6",
      "libroId": 1,
      "titulo": "El principito",
      "escuelaId": 1,
      "nombreEscuela": "Escuela Primaria...",
      "alumnoId": null,
      "alumno": null,
      "fechaVencimiento": "2025-06-30",
      "activa": true,
      "estado": "disponible",
      "fechaAsignacion": null,
      "createdAt": "2025-02-27T..."
    }
  ]
}
```

---

### GET /licencias/escuela/:id

Licencias de una escuela. Query opcionales: `libroId`, `estado`.

---

### PATCH /licencias/:id/activa

Activar o desactivar licencia.

**Body (JSON):**
```json
{ "activa": true }
```
o
```json
{ "activa": false }
```

---

## 6. Personas (registro por rol)

El admin puede registrar: padre, alumno, maestro, director.

### POST /personas/registro-director

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Descripción           |
|-----------------|--------|-------------|-----------------------|
| nombre          | string | Sí          | Nombre                |
| apellidoPaterno | string | Sí          | Apellido paterno      |
| apellidoMaterno | string | Sí          | Apellido materno      |
| email           | string | Sí          | Correo único          |
| password        | string | Sí          | Mín. 6 caracteres     |
| idEscuela       | number | Sí          | ID de la escuela      |
| telefono        | string | No          | Teléfono              |

**Ejemplo:**
```json
{
  "nombre": "Roberto",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "director@example.com",
  "password": "password123",
  "idEscuela": 1,
  "telefono": "5551112233"
}
```

---

### POST /personas/registro-maestro

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Descripción           |
|-----------------|--------|-------------|-----------------------|
| nombre          | string | Sí          | Nombre                |
| apellidoPaterno | string | Sí          | Apellido paterno      |
| apellidoMaterno | string | Sí          | Apellido materno      |
| email           | string | Sí          | Correo único          |
| password        | string | Sí          | Mín. 6 caracteres     |
| idEscuela       | number | Sí (admin)  | ID de la escuela      |
| telefono        | string | No          | Teléfono              |
| especialidad    | string | No          | Especialidad/materia  |
| fechaIngreso    | string | No          | YYYY-MM-DD            |

**Ejemplo:**
```json
{
  "nombre": "Ana",
  "apellidoPaterno": "Rodríguez",
  "apellidoMaterno": "Fernández",
  "email": "maestro@example.com",
  "password": "password123",
  "idEscuela": 1,
  "especialidad": "Matemáticas",
  "telefono": "5551234567"
}
```

---

### POST /personas/registro-alumno

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Descripción           |
|-----------------|--------|-------------|-----------------------|
| nombre          | string | Sí          | Nombre                |
| apellidoPaterno | string | Sí          | Apellido paterno      |
| apellidoMaterno | string | Sí          | Apellido materno      |
| email           | string | Sí          | Correo único          |
| password        | string | Sí          | Mín. 6 caracteres     |
| idEscuela       | number | Sí (admin)  | ID de la escuela      |
| telefono        | string | No          | Teléfono              |
| fechaNacimiento | string | No          | YYYY-MM-DD            |
| grado           | number | No          | 1-9                   |
| grupo           | string | No          | Grupo o sección       |
| cicloEscolar    | string | No          | Ej: 2024-2025         |

**Ejemplo:**
```json
{
  "nombre": "Carlos",
  "apellidoPaterno": "González",
  "apellidoMaterno": "Sánchez",
  "email": "alumno@example.com",
  "password": "password123",
  "idEscuela": 1,
  "grado": 5,
  "grupo": "A",
  "cicloEscolar": "2024-2025"
}
```

---

### POST /personas/registro-padre

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Descripción            |
|-----------------|--------|-------------|------------------------|
| nombre          | string | Sí          | Nombre                 |
| apellidoPaterno | string | Sí          | Apellido paterno       |
| apellidoMaterno | string | Sí          | Apellido materno       |
| email           | string | Sí          | Correo único           |
| password        | string | Sí          | Mín. 6 caracteres      |
| telefono        | string | No          | Teléfono               |
| fechaNacimiento | string | No          | YYYY-MM-DD             |
| alumnoId        | number | No          | ID del alumno a vincular |

---

### POST /personas/registro-padre-con-hijo

Registrar padre e hijo en una sola petición.

**Body (JSON):**
```json
{
  "padre": {
    "nombre": "María",
    "apellidoPaterno": "López",
    "apellidoMaterno": "Martínez",
    "email": "padre@example.com",
    "password": "password123"
  },
  "hijo": {
    "nombre": "Carlos",
    "apellidoPaterno": "López",
    "apellidoMaterno": "Martínez",
    "email": "carlos@example.com",
    "password": "password123",
    "idEscuela": 1,
    "grado": 5
  }
}
```

---

## 7. Auditoría

### GET /audit

Logs de auditoría. Solo administrador.

**Query params (opcionales):** `page`, `limit`

**Ejemplo:** `GET /audit?page=1&limit=20`

**Respuesta 200:**
```json
{
  "message": "Logs de auditoría obtenidos correctamente",
  "total": 50,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  },
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

Acciones registradas:
- Auth: `login`, `login_fallido`, `registro_admin`, `registro_padre`, `registro_alumno`, `registro_maestro`, `registro_director`
- Personas: `actualizar_usuario`, `eliminar_usuario`
- Escuelas: `escuela_crear`, `escuela_actualizar`, `escuela_eliminar`
- Libros: `libro_cargar`, `libro_eliminar`, `libro_activo_global`
- Director: `director_grupo_crear`, `director_grupo_actualizar`, `director_grupo_eliminar`, `director_maestro_asignar_grupo`, `director_maestro_desasignar_grupo`, `director_asignar_libro`, `director_desasignar_libro`
- Maestro: `maestro_asignar_alumno`, `maestro_desasignar_alumno`, `maestro_asignar_libro`, `maestro_desasignar_libro`
- Licencias: `licencia_canjear`

---

## 8. Carga masiva

### GET /escuelas/plantilla-carga-masiva (Público)

Descargar plantilla Excel vacía para carga masiva.

**Respuesta:** Archivo Excel (.xlsx).

---

### POST /escuelas/:id/carga-masiva

Carga masiva de alumnos o maestros desde Excel. **Content-Type: multipart/form-data.**

**FormData:**

| Campo | Tipo | Obligatorio | Descripción                         |
|-------|------|-------------|-------------------------------------|
| file  | File | Sí          | Archivo Excel (.xlsx), máx. 5 MB    |
| tipo  | string | Sí        | `alumno` o `maestro`                |

**Columnas del Excel:**
- Obligatorias: `nombre`, `email` (o `correo`)
- Opcionales: `apellidoPaterno`, `apellidoMaterno`, `password` (si no se envía se genera automática)
- Solo alumnos: `grado`, `grupo`

**Respuesta 200:**
```json
{
  "message": "Carga masiva completada. Creados: 10, errores: 2",
  "creados": 10,
  "totalErrores": 2,
  "credenciales": [
    {
      "email": "alumno1@example.com",
      "password": "abc123",
      "nombre": "Juan"
    }
  ],
  "detalleErrores": [
    { "fila": 5, "error": "Email ya registrado" }
  ],
  "excelBase64": "UEsDBBQABgAI..."
}
```

---

## Resumen de rutas solo Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /admin/dashboard | Dashboard con estadísticas |
| GET | /admin/usuarios | Listar usuarios y totales por rol |
| PATCH | /admin/usuarios/:id | Actualizar usuario |
| DELETE | /admin/usuarios/:id | Eliminar usuario |
| POST | /auth/registro-admin | Registrar administrador |
| GET | /escuelas | Listar escuelas |
| GET | /escuelas/stats | Estadísticas de escuelas |
| GET | /escuelas/directores | Listar directores |
| GET | /escuelas/con-libros | Escuelas con libros |
| POST | /escuelas | Crear escuela |
| PUT | /escuelas/:id | Actualizar escuela |
| DELETE | /escuelas/:id | Eliminar escuela |
| GET | /escuelas/:id/libros | Libros de la escuela |
| GET | /escuelas/:id/libros/asignaciones | Asignaciones libro-escuela |
| PATCH | /escuelas/:id/libros/:libroId/activo | Activar/desactivar libro en escuela |
| POST | /escuelas/:id/carga-masiva | Carga masiva de alumnos/maestros |
| POST | /libros/cargar | Cargar libro (PDF + metadatos) |
| GET | /libros | Listar libros |
| GET | /libros/:id | Detalle de libro |
| GET | /libros/:id/pdf | Descargar PDF |
| GET | /libros/:id/escuelas | Escuelas con el libro |
| PATCH | /libros/:id/escuelas/:escuelaId/activo | Activar/desactivar en escuela |
| PATCH | /libros/:id/activo | Activar/desactivar globalmente |
| DELETE | /libros/:id | Eliminar libro |
| POST | /licencias/generar | Generar licencias |
| GET | /licencias | Listar licencias (filtros) |
| PATCH | /licencias/:id/activa | Activar/desactivar licencia |
| POST | /personas/registro-* | Registro padre, alumno, maestro, director |
| GET | /audit | Logs de auditoría |

---

*Última actualización: Marzo 2025*
