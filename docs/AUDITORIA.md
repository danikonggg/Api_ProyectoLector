# Módulo de Auditoría

Registro de acciones sensibles para que el administrador pueda revisar quién hizo qué y cuándo.

---

## Endpoint (solo admin)

### GET /audit

Lista los logs de auditoría. Requiere token JWT y ser administrador.

**Query params (opcionales):**
- `page` – Página (1-based)
- `limit` – Registros por página

**Ejemplo:**
```
GET /audit?page=1&limit=20
Authorization: Bearer <token>
```

**Respuesta:**
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

## Acciones registradas

| Acción | Descripción |
|--------|-------------|
| `login` | Inicio de sesión exitoso |
| `login_fallido` | Intento de login fallido (usuario no encontrado, contraseña incorrecta, usuario inactivo) |
| `registro_admin` | Registro de administrador inicial |
| `registro_padre` | Registro de padre/tutor |
| `registro_alumno` | Registro de alumno |
| `registro_maestro` | Registro de maestro |
| `registro_director` | Registro de director |
| `escuela_crear` | Creación de escuela |
| `escuela_actualizar` | Actualización de escuela |
| `escuela_eliminar` | Eliminación de escuela |
| `libro_cargar` | Carga de libro (PDF) |
| `libro_eliminar` | Eliminación de libro |

---

## Migración

Ejecutar el script SQL para crear la tabla:

```bash
psql -U postgres -d api_lector -f migrations/add_audit_log.sql
```
