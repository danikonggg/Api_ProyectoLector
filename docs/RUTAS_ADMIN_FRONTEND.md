# Rutas API – Solo Administrador

Documento para el equipo de frontend. Todas las rutas requieren **JWT** en header: `Authorization: Bearer <access_token>`.

---

## 1. Dashboard

### GET `/admin/dashboard`
Estadísticas del sistema: escuelas activas, estudiantes, profesores, libros disponibles.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):**
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

| Campo | Descripción |
|-------|-------------|
| escuelasActivas | Total de escuelas registradas |
| totalEstudiantes | Total de alumnos en el sistema |
| totalProfesores | Total de maestros en el sistema |
| librosDisponibles | Libros con estado "listo" (disponibles para asignar) |

---

## 2. Auth

### POST `/auth/registro-admin`
Registrar nuevo administrador (máx. 5).

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Body | JSON (ver abajo) |

**Body:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "admin@example.com",
  "password": "password123",
  "telefono": "1234567890",
  "fechaNacimiento": "1990-01-01",
  "nivel": "super"
}
```

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| nombre | string | Sí |
| apellidoPaterno | string | Sí |
| apellidoMaterno | string | Sí |
| email | string | Sí |
| password | string | Sí (mín. 6) |
| telefono | string | No |
| fechaNacimiento | string | No (YYYY-MM-DD) |
| nivel | string | No |

**Recibo (201):**
```json
{
  "message": "Administrador registrado exitosamente",
  "description": "El administrador ha sido creado correctamente. Total de administradores: 4/5",
  "data": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "correo": "admin@example.com",
    "tipoPersona": "administrador"
  },
  "administrador": {
    "id": 1,
    "fechaAlta": "2025-02-06T12:00:00.000Z"
  }
}
```

**Errores:** 401, 403, 409 (email duplicado o límite de 5 admins).

---

## 3. Personas

### GET `/personas/admins`
Listar todos los administradores.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):**
```json
{
  "message": "Administradores obtenidos exitosamente",
  "description": "Se encontraron 3 administrador(es) en el sistema",
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

### GET `/personas/admins/cantidad`
Cantidad de admins y cupo restante.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):**
```json
{
  "cantidad": 3,
  "maxAdmins": 5,
  "mensaje": "Puedes registrar 2 administrador(es) más"
}
```

---

### GET `/personas/alumnos`
Listar alumnos. Admin ve todos; se puede filtrar por escuela. Incluye persona, escuela y padre (si tiene).

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Query | `escuelaId`, `page`, `limit` (todos opcionales) |

| Query | Tipo | Descripción |
|-------|------|-------------|
| escuelaId | number | Filtrar por ID de escuela |
| page | number | Página (paginación) |
| limit | number | Cantidad por página |

**Recibo (200):**
```json
{
  "message": "Alumnos obtenidos exitosamente",
  "description": "Se encontraron 2 alumno(s)",
  "total": 2,
  "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 },
  "data": [
    {
      "id": 1,
      "personaId": 5,
      "escuelaId": 1,
      "padreId": null,
      "grado": "3",
      "grupo": "A",
      "cicloEscolar": "2024-2025",
      "persona": { "id": 5, "nombre": "Ana", "apellido": "López", "correo": "ana@example.com", "telefono": "5551234" },
      "escuela": { "id": 1, "nombre": "Escuela Primaria", "nivel": "primaria" },
      "padre": null
    }
  ]
}
```

Sin `page` y `limit` se devuelven todos (sin objeto `meta`).

**Errores:** 401, 403.

---

### GET `/personas/alumnos/buscar`
Búsqueda **global** por un solo campo: solo se envían `campo` y `valor`. Sin paginación ni filtro por escuela. Admin: todos los resultados; Director: solo su escuela.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Query | Solo `campo` y `valor` (obligatorios) |

| Query | Tipo | Descripción |
|-------|------|-------------|
| campo | string | Uno de: `nombre`, `apellido`, `correo`, `telefono`, `grado`, `grupo`, `cicloEscolar`, `escuelaId` |
| valor | string | Valor a buscar (texto parcial o número para grado/escuelaId) |

**Ejemplos:**
- Por nombre: `GET /personas/alumnos/buscar?campo=nombre&valor=Ana`
- Por correo: `GET /personas/alumnos/buscar?campo=correo&valor=@escuela`
- Por grado: `GET /personas/alumnos/buscar?campo=grado&valor=3`

**Recibo (200):** `message`, `description`, `total`, `data` (lista de alumnos; sin `meta`).

**Errores:** 400 (campo no permitido, valor vacío o falta campo/valor), 401, 403.

---

### GET `/personas/alumnos/:id`
Obtener un alumno por ID (con persona, escuela y padre si tiene).

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID del alumno |

**Recibo (200):**
```json
{
  "message": "Alumno obtenido exitosamente",
  "description": "Alumno encontrado en el sistema",
  "data": {
    "id": 1,
    "personaId": 5,
    "escuelaId": 1,
    "padreId": 2,
    "grado": "3",
    "grupo": "A",
    "cicloEscolar": "2024-2025",
    "persona": { "id": 5, "nombre": "Ana", "apellido": "López", "correo": "ana@example.com", "telefono": "5551234" },
    "escuela": { "id": 1, "nombre": "Escuela Primaria", "nivel": "primaria" },
    "padre": {
      "id": 2,
      "parentesco": "madre",
      "persona": { "id": 8, "nombre": "María", "apellido": "López", "correo": "maria@example.com", "telefono": "5555678" }
    }
  }
}
```

**Errores:** 401, 403, 404 (alumno no encontrado).

---

### POST `/personas/registro-padre`
Registrar padre/tutor.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Body | JSON |

**Body:**
```json
{
  "nombre": "María",
  "apellidoPaterno": "López",
  "apellidoMaterno": "Martínez",
  "email": "padre@example.com",
  "password": "password123",
  "telefono": "0987654321",
  "fechaNacimiento": "1985-05-15",
  "alumnoId": 1
}
```

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| nombre | string | Sí |
| apellidoPaterno | string | Sí |
| apellidoMaterno | string | Sí |
| email | string | Sí |
| password | string | Sí (mín. 6) |
| telefono | string | No |
| fechaNacimiento | string | No (YYYY-MM-DD) |
| alumnoId | number | No (vincula padre con alumno) |

**Recibo (201):**
```json
{
  "message": "Padre registrado exitosamente",
  "description": "El padre/tutor ha sido creado correctamente.",
  "data": {
    "idPersona": 1,
    "nombre": "María",
    "email": "padre@example.com",
    "tipoPersona": "padre"
  }
}
```

---

### POST `/personas/registro-director`
Registrar director de escuela.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Body | JSON |

**Body:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "director@example.com",
  "password": "password123",
  "idEscuela": 1,
  "telefono": "5551234567",
  "fechaNacimiento": "1975-05-15",
  "fechaNombramiento": "2020-01-15"
}
```

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| nombre | string | Sí |
| apellidoPaterno | string | Sí |
| apellidoMaterno | string | Sí |
| email | string | Sí |
| password | string | Sí (mín. 6) |
| idEscuela | number | Sí |
| telefono | string | No |
| fechaNacimiento | string | No (YYYY-MM-DD) |
| fechaNombramiento | string | No (YYYY-MM-DD) |

**Recibo (201):**
```json
{
  "message": "Director registrado exitosamente",
  "description": "El director ha sido creado correctamente.",
  "data": {
    "idPersona": 1,
    "nombre": "Juan",
    "email": "director@example.com",
    "tipoPersona": "director"
  }
}
```

---

### GET `/personas/padres`
Listar todos los padres. Paginación opcional.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Query | `?page=1&limit=20` (opcional) |

**Recibo (200):** Lista de padres con sus alumnos.

---

### GET `/personas/padres/:id`
Obtener padre por ID con sus hijos.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID del padre |

**Recibo (200):** Padre con sus alumnos.

---

### GET `/personas/padres/:id/alumnos`
Listar alumnos (hijos) de un padre.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID del padre |

**Recibo (200):** Lista de alumnos del padre.

---

## 4. Escuelas

### POST `/escuelas`
Crear escuela.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Body | JSON |

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

| Campo | Tipo | Obligatorio | Límite |
|-------|------|-------------|--------|
| nombre | string | Sí | 150 |
| nivel | string | Sí | 50 |
| clave | string | No | 50 |
| direccion | string | No | 200 |
| telefono | string | No | 20 |

**Recibo (201):**
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

### GET `/escuelas`
Listar todas las escuelas.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Query | `?page=1&limit=20` (opcional) |

**Recibo (200):**
```json
{
  "message": "Escuelas obtenidas exitosamente",
  "description": "Se encontraron 5 escuela(s) en el sistema",
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
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### PUT `/escuelas/:id`
Actualizar escuela.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `PUT` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Params | `id` = ID de la escuela |
| Body | JSON (solo campos a actualizar) |

**Body (todos opcionales):**
```json
{
  "nombre": "Nuevo nombre",
  "nivel": "Primaria",
  "clave": "29DPR0123X",
  "direccion": "Nueva dirección",
  "telefono": "5551234567"
}
```

**Recibo (200):** Escuela actualizada.

---

### DELETE `/escuelas/:id`
Eliminar escuela.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `DELETE` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID de la escuela |

**Recibo (200):**
```json
{
  "message": "Escuela eliminada exitosamente",
  "description": "La escuela ha sido eliminada del sistema."
}
```

**Errores:** 400 si tiene alumnos o maestros asociados.

---

### POST `/escuelas/:id/libros`
Otorgar libro a la escuela (Paso 1). La escuela debe canjear después.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Params | `id` = ID de la escuela |
| Body | JSON |

**Body:**
```json
{
  "codigo": "LIB-1735123456-abc12345"
}
```

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| codigo | string | Sí (código del libro) |

**Recibo (201):** Libro otorgado; la escuela debe canjear el código.

**Errores:** 404 (escuela o libro no encontrado), 409 (ya otorgado o canjeado).

---

## 5. Libros

### POST `/libros/cargar`
Cargar libro (PDF + metadatos).

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>` (sin Content-Type; se usa multipart) |
| Body | `multipart/form-data` |

**FormData:**
| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| pdf | File | Sí | Archivo PDF (máx. 50 MB) |
| titulo | string | Sí | Título (máx. 150) |
| grado | number | Sí | Grado escolar |
| descripcion | string | No | Máx. 255 |
| codigo | string | No | Si no se envía, se genera |
| materiaId | number | No | Opcional |

**Ejemplo (fetch):**
```js
const form = new FormData();
form.append('pdf', fileInput.files[0]);
form.append('titulo', 'El principito');
form.append('grado', 5);
form.append('descripcion', 'Libro de lectura');

await fetch(`${BASE_URL}/libros/cargar`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: form,
});
```

**Recibo (201):**
```json
{
  "message": "Libro cargado exitosamente",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "codigo": "LIB-1735123456-abc12345",
    "grado": 5,
    "descripcion": "Libro de lectura",
    "estado": "listo",
    "numPaginas": 15,
    "unidades": []
  }
}
```

---

### GET `/libros`
Listar todos los libros.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):**
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

---

### GET `/libros/:id/pdf`
Descargar PDF del libro. Solo administradores.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID del libro |

**Recibo (200):** Archivo PDF (`Content-Type: application/pdf`).

---

### DELETE `/libros/:id`
Eliminar libro por completo.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `DELETE` |
| Headers | `Authorization: Bearer <token>` |
| Params | `id` = ID del libro |

**Recibo (200):** Libro eliminado.

---

## 6. Auditoría

### GET `/audit`
Listar logs de auditoría.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |
| Query | `?page=1&limit=20` (opcional) |

**Recibo (200):**
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

---

## Resumen tabla

| Método | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/admin/dashboard` | — |
| POST | `/auth/registro-admin` | `{ nombre, apellidoPaterno, apellidoMaterno, email, password, telefono?, fechaNacimiento?, nivel? }` |
| GET | `/personas/admins` | — |
| GET | `/personas/admins/cantidad` | — |
| GET | `/personas/alumnos` | Query: `?escuelaId=&page=&limit=` |
| GET | `/personas/alumnos/buscar` | Query: `campo`, `valor` (búsqueda global, sin paginación) |
| GET | `/personas/alumnos/:id` | Params: `id` |
| POST | `/personas/registro-padre` | `{ nombre, apellidoPaterno, apellidoMaterno, email, password, telefono?, fechaNacimiento?, alumnoId? }` |
| POST | `/personas/registro-director` | `{ nombre, apellidoPaterno, apellidoMaterno, email, password, idEscuela, telefono?, fechaNacimiento?, fechaNombramiento? }` |
| GET | `/personas/padres` | Query: `?page=&limit=` |
| GET | `/personas/padres/:id` | Params: `id` |
| GET | `/personas/padres/:id/alumnos` | Params: `id` |
| POST | `/escuelas` | `{ nombre, nivel, clave?, direccion?, telefono? }` |
| GET | `/escuelas` | Query: `?page=&limit=` |
| PUT | `/escuelas/:id` | `{ nombre?, nivel?, clave?, direccion?, telefono? }` |
| DELETE | `/escuelas/:id` | Params: `id` |
| POST | `/escuelas/:id/libros` | `{ codigo }` |
| POST | `/libros/cargar` | FormData: `pdf`, `titulo`, `grado`, `descripcion?`, `codigo?`, `materiaId?` |
| GET | `/libros` | — |
| GET | `/libros/:id/pdf` | Params: `id` |
| DELETE | `/libros/:id` | Params: `id` |
| GET | `/audit` | Query: `?page=&limit=` |

---

**Base URL:** `http://localhost:3000` (o la URL del backend en tu entorno)
