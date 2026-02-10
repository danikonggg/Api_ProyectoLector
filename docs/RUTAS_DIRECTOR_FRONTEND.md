# Rutas API – Director de Escuela

Documento para el equipo de frontend. Ruta exclusiva para directores. Requiere **JWT** en header: `Authorization: Bearer <access_token>`.

---

## Dashboard

### GET `/director/dashboard`
Estadísticas de la escuela del director: datos de la escuela, estudiantes, profesores, libros.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):**
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
| escuela | Datos de la escuela del director |
| totalEstudiantes | Alumnos en su escuela |
| totalProfesores | Maestros en su escuela |
| librosDisponibles | Libros asignados y activos en su escuela |

**Errores:** 401 (no autenticado), 403 (solo directores).

---

## Libros (sin enviar ID de escuela)

La escuela se toma del token; el director **no** envía nunca el ID de escuela.

### GET `/director/libros`
Libros activos (ya canjeados) en la escuela del director.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):** `{ message, data: [ ... ] }` con los libros activos.

---

### GET `/director/libros/pendientes`
Libros otorgados por el admin que la escuela aún no ha canjeado.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `GET` |
| Headers | `Authorization: Bearer <token>` |

**Recibo (200):** `{ message, data: [ { titulo, grado }, ... ] }` (sin código; el admin lo entrega aparte).

---

### POST `/director/canjear-libro`
Canjear un libro con el código que dio el administrador. Solo se envía el código.

| Cómo lo mando | Valor |
|---------------|-------|
| Método | `POST` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| Body | `{ "codigo": "LIB-..." }` |

**Recibo (201):** Libro canjeado correctamente.

**Errores:** 400 (código no otorgado a tu escuela o ya canjeado), 401, 403.

---

**Base URL:** `http://localhost:3000` (o la URL del backend en tu entorno)
