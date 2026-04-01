# Documentación: Maestros, Materias y Libros

Guía de cómo funcionan maestros, materias, asignación alumno–maestro–materia, y libros ligados a materias.

---

## 1. Materias

Una **materia** representa una asignatura (ej. Lectura, Matemáticas). Se usa en:
- **Alumno_Maestro**: alumno asignado a un maestro en una materia
- **Libro**: un libro puede asociarse a una materia (`materiaId` opcional)

### Endpoints de Materias

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/materias` | JWT | Listar todas las materias |
| GET | `/materias/:id` | JWT | Obtener materia por ID |
| POST | `/materias` | Admin | Crear materia |
| PATCH | `/materias/:id` | Admin | Actualizar materia |
| DELETE | `/materias/:id` | Admin | Eliminar materia |

### Crear materia (POST /materias)

**Body:**
```json
{
  "nombre": "Matemáticas",
  "descripcion": "Matemáticas para primaria",
  "nivel": "General"
}
```

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `nombre` | Sí | Nombre de la materia (único) |
| `descripcion` | No | Descripción |
| `nivel` | No | Ej. General, Primaria, Secundaria |

### Seed inicial

Si usas `complete_database_setup.sql` o `seed_lectura.sql`, ya existe la materia **"Lectura"** (id=1). Las demás materias debes crearlas con POST /materias.

---

## 2. Maestros

Un **maestro** pertenece a una escuela y puede asignar alumnos a sus clases por materia.

### Flujo maestro–alumno–materia

1. **Asignar alumno a la clase** (POST /maestros/asignar-alumno):
   - El maestro envía `alumnoId` y `materiaId`
   - El alumno debe ser de la misma escuela que el maestro
   - Se crea un registro en `Alumno_Maestro`

2. **Alumnos de mi escuela** (GET /maestros/alumnos-de-mi-escuela):
   - Devuelve alumnos de la escuela del maestro (para asignar a la clase)

3. **Ver mis alumnos** (GET /maestros/mis-alumnos):
   - Devuelve alumnos asignados al maestro (con `materiaAsignada`)

4. **Desasignar alumno** (DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId)

### Endpoints de Maestros (requieren rol Maestro)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/maestros/alumnos-de-mi-escuela` | Alumnos de la escuela del maestro (para asignar) |
| GET | `/maestros/mis-alumnos` | Listar alumnos asignados |
| GET | `/maestros/mis-alumnos/:id` | Obtener un alumno (solo si está asignado) |
| POST | `/maestros/asignar-alumno` | Asignar alumno a mi clase |
| DELETE | `/maestros/mis-alumnos/:alumnoId/materia/:materiaId` | Desasignar alumno |
| GET | `/maestros/libros-disponibles-para-asignar` | Libros disponibles para asignar (query: `?alumnoId=`) |
| POST | `/maestros/asignar-libro` | Asignar libro a alumno |
| DELETE | `/maestros/desasignar-libro/:alumnoId/:libroId` | Desasignar libro |

### Asignar alumno (POST /maestros/asignar-alumno)

**Body:**
```json
{
  "alumnoId": 5,
  "materiaId": 1
}
```

El maestro necesita conocer el `materiaId` (ej. 1 para Lectura). Puede obtener la lista con **GET /materias**.

---

## 3. Libros

Un **libro** puede asociarse a una materia (`materiaId` opcional). Los libros se otorgan a escuelas y luego se asignan a alumnos.

### Cargar libro (POST /libros/cargar)

**FormData (multipart/form-data):**

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `pdf` | Sí | Archivo PDF |
| `titulo` | Sí | Título del libro |
| `grado` | Sí | Grado escolar (1–6) |
| `materiaId` | No | ID de la materia (ej. 1 = Lectura) |
| `codigo` | No | Código único (ej. LECT-2024) |
| `descripcion` | No | Descripción |

**Ejemplo:**
- PDF: archivo.pdf
- titulo: El principito
- grado: 5
- materiaId: 1
- codigo: LECT-2024

### Flujo libro en escuela

1. **Admin carga libro** → POST /libros/cargar (puede incluir `materiaId`)
2. **Admin otorga a escuela** → POST /escuelas/:id/libros con `{ "codigo": "LIB-..." }`
3. **Director canjea** → POST /director/canjear-libro o POST /escuelas/:id/libros/canjear
4. **Director o maestro asigna libro a alumno**:
   - Director: POST /director/asignar-libro
   - Maestro: POST /maestros/asignar-libro
   - Body: `{ "alumnoId", "libroId" }`

---

## 4. Resumen de flujos

### Alta de materias (Admin)

1. GET /materias → ver materias existentes
2. POST /materias → crear nuevas (ej. Matemáticas, Español, Ciencias)

### Maestro asigna alumnos

1. GET /materias → listar materias (para el dropdown)
2. GET /maestros/alumnos-de-mi-escuela → alumnos de tu escuela
3. POST /maestros/asignar-alumno → `{ alumnoId, materiaId }`

### Admin carga libro con materia

1. POST /libros/cargar con FormData:
   - pdf, titulo, grado
   - materiaId: 1 (Lectura) u otra materia existente

### Maestro/Director asigna libro a alumno

1. GET /maestros/libros-disponibles-para-asignar?alumnoId=X (o equivalente en director)
2. POST /maestros/asignar-libro (o /director/asignar-libro) con `{ alumnoId, libroId }`

---

*Última actualización: Febrero 2025*
