# Flujo Admin: Libros y Licencias (Frontend)

Documento para el equipo de frontend. Todos los endpoints requieren **JWT** en header: `Authorization: Bearer <token>`. Solo rol **Administrador**.

---

## 1. FLUJO DE LIBROS (Admin)

### Paso 1: Cargar libro (PDF + metadatos)

Admin sube un PDF y los metadatos del libro. El backend procesa, segmenta y guarda.

| Método | Ruta | Tipo | Descripción |
|--------|------|------|-------------|
| POST | `/libros/cargar` | multipart/form-data | Cargar libro |

**Body (FormData):**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| pdf | File | Sí | Archivo PDF |
| titulo | string | Sí | Ej: "El principito" |
| grado | number | Sí | 1-6 |
| codigo | string | No | Ej: "LECT-2024" |
| descripcion | string | No | Descripción |
| materiaId | number | No | ID de materia |

**Respuesta 201:**
```json
{
  "message": "...",
  "data": { "id": 1, "titulo": "...", "codigo": "...", "grado": 5, "estado": "listo", ... }
}
```

---

### Paso 2: Listar libros

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/libros` | Lista todos los libros |

**Respuesta 200:**
```json
{
  "message": "...",
  "data": [
    { "id": 1, "titulo": "El principito", "codigo": "LECT-2024", "grado": 5, "estado": "listo", "activo": true, ... }
  ]
}
```

---

### Paso 3: Descargar PDF de un libro

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/libros/:id/pdf` | Devuelve el archivo PDF |

**Nota:** La respuesta es el binario del PDF (`Content-Type: application/pdf`). Usar `fetch` y `blob()` para descargar.

---

### Paso 4: Ver libros por escuela / activar-desactivar libro en escuela

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/escuelas/:id/libros` | Libros activos de la escuela |
| GET | `/escuelas/:id/libros/asignaciones` | Todas las asignaciones libro-escuela (activo/inactivo) |
| PATCH | `/escuelas/:id/libros/:libroId/activo` | Activar/desactivar libro solo en esa escuela |

**PATCH Body:**
```json
{ "activo": true }
```
o
```json
{ "activo": false }
```

---

## 2. FLUJO DE LICENCIAS (Admin)

Las licencias son **individuales por alumno**. Cada licencia = 1 alumno. El admin genera licencias para una escuela y un libro; la escuela reparte las claves a los alumnos; cada alumno canjea su clave para tener el libro.

### Paso 1: Obtener datos necesarios (escuelas y libros)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/escuelas` | Lista de escuelas (para dropdown) |
| GET | `/libros` | Lista de libros (para dropdown) |

---

### Paso 2: Generar licencias

Admin indica: escuela, libro, cantidad, fecha de vencimiento. El sistema genera claves únicas.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/licencias/generar` | Generar lote de licencias |

**Body (JSON):**
```json
{
  "escuelaId": 1,
  "libroId": 1,
  "cantidad": 50,
  "fechaVencimiento": "2025-06-30"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| escuelaId | number | Sí | ID de la escuela |
| libroId | number | Sí | ID del libro |
| cantidad | number | Sí | 1-1000 |
| fechaVencimiento | string | Sí | ISO 8601 (YYYY-MM-DD) |

**Respuesta 201:**
```json
{
  "message": "Se generaron 50 licencias correctamente.",
  "description": "Libro \"...\". Escuela: ... . Vencimiento: 2025-06-30.",
  "data": {
    "escuelaId": 1,
    "libroId": 1,
    "titulo": "El principito",
    "cantidad": 50,
    "fechaVencimiento": "2025-06-30",
    "claves": ["LECT-A1B2-C3D4-E5F6", "LECT-X7Y8-Z9W2-Q4R5", ...]
  }
}
```

**Importante:** Las claves en `data.claves` se entregan a la escuela. Cada alumno canjea su clave en la app (POST `/licencias/canjear` — alumno/director/maestro).

---

### Paso 3: Listar licencias (con filtros)

| Método | Ruta | Query params | Descripción |
|--------|------|--------------|-------------|
| GET | `/licencias` | `escuelaId`, `libroId`, `estado` | Lista licencias con filtros |

**Query params (todos opcionales):**

| Param | Tipo | Valores | Descripción |
|-------|------|---------|-------------|
| escuelaId | number | ID | Filtrar por escuela |
| libroId | number | ID | Filtrar por libro |
| estado | string | `disponible`, `usada`, `vencida` | Filtrar por estado |

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
    },
    ...
  ]
}
```

**Campos de cada licencia:**
- `id`: ID de la licencia
- `clave`: Clave única (ej. LECT-A1B2-C3D4-E5F6)
- `libroId`, `titulo`: Libro
- `escuelaId`, `nombreEscuela`: Escuela
- `alumnoId`, `alumno`: Si está usada, alumno que la canjeó
- `fechaVencimiento`: Fecha límite
- `activa`: Si el admin la tiene activa
- `estado`: `disponible` | `usada` | `vencida`

---

### Paso 4: Licencias de una escuela (alternativa)

| Método | Ruta | Query params | Descripción |
|--------|------|--------------|-------------|
| GET | `/licencias/escuela/:id` | `libroId`, `estado` | Licencias de una escuela |

**Respuesta:** Igual estructura que `GET /licencias`.

---

### Paso 5: Activar/desactivar licencia

| Método | Ruta | Descripción |
|--------|------|-------------|
| PATCH | `/licencias/:id/activa` | Activar o desactivar licencia |

**Body:**
```json
{ "activa": true }
```
o
```json
{ "activa": false }
```

---

## 3. FLUJO DE ESCUELAS (relacionado con libros)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/escuelas` | Lista escuelas |
| GET | `/escuelas/:id` | Detalle de escuela |
| GET | `/escuelas/:id/libros` | Libros activos de la escuela |
| GET | `/escuelas/:id/libros/asignaciones` | Asignaciones libro-escuela |
| PATCH | `/escuelas/:id/libros/:libroId/activo` | Activar/desactivar libro en escuela |
| POST | `/escuelas` | Crear escuela (body: nombre, nivel, clave, direccion, telefono, etc.) |

---

## 4. RESUMEN PARA FRONTEND ADMIN

### Pantalla Libros
1. **Cargar libro:** Formulario con input file (PDF), titulo, grado, codigo opcional. POST `/libros/cargar` (FormData).
2. **Lista de libros:** GET `/libros`. Tabla con ID, título, grado, código, estado. Botón para descargar PDF: GET `/libros/:id/pdf`.
3. **Ver libros por escuela:** Botón en Escuelas → GET `/escuelas/:id/libros`. Opcional: PATCH para activar/desactivar.

### Pantalla Licencias
1. **Generar licencias:** Formulario con dropdowns Escuela (GET `/escuelas`), Libro (GET `/libros`), cantidad (input number 1-1000), fecha vencimiento (date). POST `/licencias/generar`.
2. **Resultado:** Mostrar `data.claves` para que el admin copie y entregue a la escuela.
3. **Lista de licencias:** GET `/licencias` con filtros opcionales (escuelaId, libroId, estado). Tabla con clave, libro, escuela, estado, vencimiento, alumno.
4. **Activar/desactivar:** PATCH `/licencias/:id/activa` con `{ activa: true/false }`.

### Pantalla Escuelas
1. Crear escuela: POST `/escuelas`.
2. Lista: GET `/escuelas`.
3. Ver libros: GET `/escuelas/:id/libros` (no hay otorgar/canjear por código; todo va por licencias).

---

## 5. AUTENTICACIÓN

Todos los requests llevan:
```
Authorization: Bearer <token>
```

El token se obtiene de POST `/auth/login` con `{ correo, password }`.
