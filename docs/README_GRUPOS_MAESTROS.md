# README: Grupos, Maestros y Alumnos

Guía para configurar grupos, registrar maestros, asignar maestros a grupos y dar de alta alumnos. Todo esto lo hace el **Director** de la escuela (con JWT).

---

## Orden recomendado

1. **Director crea grupos** (ej. 1A, 2B, 3A…)
2. **Director registra maestros** (carga masiva o registro individual)
3. **Director asigna maestros a grupos**
4. **Director registra alumnos** (con grado+grupo o grupoId) o hace carga masiva

---

## 1. Grupos

### Crear grupo

| Método | Ruta | Body |
|--------|------|------|
| POST | `/director/grupos` | `{ "grado": 1, "nombre": "A" }` |

**Ejemplo:**
```json
{
  "grado": 1,
  "nombre": "A"
}
```

- `grado`: 1–6 (o más según tu sistema)
- `nombre`: sección del grupo (A, B, 1, etc.)

**Respuesta 201:** objeto del grupo creado con `id`, `grado`, `nombre`, `escuelaId`.

### Listar grupos

| Método | Ruta |
|--------|------|
| GET | `/director/grupos` |

**Respuesta:** array de grupos con `id`, `escuelaId`, `grado`, `nombre`, `activo` y `maestros` (array de maestros asignados: `id`, `personaId`, `nombre`, `correo`).

### Actualizar grupo

| Método | Ruta | Body |
|--------|------|------|
| PATCH | `/director/grupos/:id` | `{ "grado"?, "nombre"?, "activo"?, "maestroIds"?: [5, 7], "alumnoIds"?: [10, 11] }` |

- `maestroIds` (opcional): array de IDs de maestros asignados al grupo. Reemplaza la lista actual. `[]` quita todos.
- `alumnoIds` (opcional): array de IDs de alumnos en el grupo. Reemplaza la lista actual. `[]` quita a todos.

### Eliminar grupo

| Método | Ruta |
|--------|------|
| DELETE | `/director/grupos/:id` |

---

## 2. Maestros

### Registrar maestro individual

| Método | Ruta | Body |
|--------|------|------|
| POST | `/personas/registro-maestro` | `{ "nombre", "apellidoPaterno", "apellidoMaterno", "email", "password", "idEscuela" }` |

El **Director** no envía `idEscuela`; se usa la de su token.

### Carga masiva de maestros

| Método | Ruta | Formato |
|--------|------|---------|
| POST | `/director/carga-masiva` | `multipart/form-data`: `file` (Excel), `tipo: "maestro"` |

**Columnas Excel:** `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`, `password` (opcional).

### Listar maestros de la escuela

| Método | Ruta |
|--------|------|
| GET | `/director/maestros` |

---

## 3. Asignar maestros a grupos

### Asignar grupo a maestro

| Método | Ruta | Body |
|--------|------|------|
| POST | `/director/maestros/asignar-grupo` | `{ "maestroId": 5, "grupoId": 2 }` |

### Ver grupos de un maestro

| Método | Ruta |
|--------|------|
| GET | `/director/maestros/:maestroId/grupos` |

### Desasignar grupo de maestro

| Método | Ruta |
|--------|------|
| DELETE | `/director/maestros/desasignar-grupo/:maestroId/:grupoId` |

---

## 4. Alumnos

### Registrar alumno (con grupo)

**Opción A – grado + nombre de grupo:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "juan@example.com",
  "password": "abc123",
  "grado": 1,
  "grupo": "A"
}
```
El grupo debe existir en la escuela (ej. 1A).

**Opción B – grupoId:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "juan@example.com",
  "password": "abc123",
  "grupoId": 2
}
```

### Carga masiva de alumnos

| Método | Ruta | Formato |
|--------|------|---------|
| POST | `/director/carga-masiva` | `multipart/form-data`: `file` (Excel), `tipo: "alumno"` |

**Columnas Excel obligatorias:** `nombre`, `apellidoPaterno`, `apellidoMaterno`, `email`.

**Opcionales:** `password`, `grado`, `grupo`, `cicloEscolar`.

Si envías `grado` y `grupo`, debe existir un grupo con ese grado y nombre en la escuela.

### Listar alumnos

| Método | Ruta |
|--------|------|
| GET | `/director/alumnos` |

### Cambiar grupo de alumno (ya registrado)

**PATCH** `/personas/alumnos/:id` solo actualiza datos de la persona (nombre, correo, teléfono). **Para cambiar el grupo** usa uno de estos endpoints:

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| PATCH | `/director/alumnos/:id` | `{ "grupoId": 2 }` | Cambiar el grupo de un alumno |
| PATCH | `/director/grupos/:id` | `{ "alumnoIds": [10, 11, 12] }` | Asignar alumnos a un grupo |

**PATCH /director/alumnos/:id** (centrado en el alumno):
```json
{ "grupoId": 2 }
```
- `grupoId`: ID del grupo. `null` quita al alumno del grupo.

**PATCH /director/grupos/:id** (centrado en el grupo, con alumnoIds):
```json
{ "alumnoIds": [10, 11, 12] }
```
- `alumnoIds`: array de IDs de alumnos. Reemplaza la lista actual. `[]` quita a todos del grupo.

**Ejemplos curl:**
```bash
# Mover alumno 10 al grupo 2
curl -X PATCH http://localhost:3000/director/alumnos/10 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grupoId":2}'

# Quitar alumno del grupo
curl -X PATCH http://localhost:3000/director/alumnos/10 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grupoId":null}'

# Asignar alumnos 10, 11, 12 al grupo 1
curl -X PATCH http://localhost:3000/director/grupos/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alumnoIds":[10,11,12]}'
```

---

## 5. Migraciones SQL (base de datos)

Aplicar en este orden:

```bash
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh
```

O manualmente:

```bash
psql -U postgres -d api_lector -f migrations/add_grupo_table.sql
psql -U postgres -d api_lector -f migrations/add_maestro_grupo_table.sql
psql -U postgres -d api_lector -f migrations/add_alumno_grupo_id.sql
psql -U postgres -d api_lector -f migrations/backfill_alumno_grupo_id.sql
```

---

## 6. Validaciones

| Caso | Comportamiento |
|------|----------------|
| Carga masiva con `grado` + `grupo` | Debe existir el grupo en la escuela, si no → error |
| Registro alumno con `grupoId` o `grado`+`grupo` | Se valida que el grupo exista |
| Maestro sin grupos | No puede asignar alumnos ni libros |
| Nombres de grupo | Se guardan en mayúsculas; las comparaciones son case-insensitive |

---

## 7. Ejemplo de flujo completo

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"director@escuela.com","password":"pass123"}'
# Guarda el access_token

# 2. Crear grupos
curl -X POST http://localhost:3000/director/grupos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grado":1,"nombre":"A"}'
curl -X POST http://localhost:3000/director/grupos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grado":1,"nombre":"B"}'

# 3. Registrar maestro (o usar carga masiva)
curl -X POST http://localhost:3000/personas/registro-maestro \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"María","apellidoPaterno":"López","apellidoMaterno":"Ruiz","email":"maestro@escuela.com","password":"pass123"}'

# 4. Listar grupos y maestros para obtener IDs
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/director/grupos
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/director/maestros

# 5. Asignar maestro al grupo 1A - Opción A: POST separado
curl -X POST http://localhost:3000/director/maestros/asignar-grupo \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maestroId":5,"grupoId":1}'

# 5b. Asignar maestro al grupo - Opción B: PATCH del grupo con maestroIds
curl -X PATCH http://localhost:3000/director/grupos/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maestroIds":[5,7]}'

# 6. Registrar alumno en grupo 1A
curl -X POST http://localhost:3000/personas/registro-alumno \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellidoPaterno":"Pérez","apellidoMaterno":"García","email":"juan@escuela.com","password":"pass123","grado":1,"grupo":"A"}'
```

---

## 8. Ver maestros por grupo (o grupos por maestro)

| Quieres ver… | Endpoint |
|--------------|----------|
| Maestros de cada grupo | `GET /director/grupos` (cada grupo incluye array `maestros`) |
| Grupos de un maestro | `GET /director/maestros/:maestroId/grupos` |

---

## 9. Resumen de endpoints

| Acción | Método | Ruta |
|--------|--------|------|
| Crear grupo | POST | `/director/grupos` |
| Listar grupos (con maestros) | GET | `/director/grupos` |
| Actualizar grupo (grado, nombre, activo, maestroIds, alumnoIds) | PATCH | `/director/grupos/:id` |
| Eliminar grupo | DELETE | `/director/grupos/:id` |
| Asignar grupo a maestro | POST | `/director/maestros/asignar-grupo` |
| Grupos de un maestro | GET | `/director/maestros/:maestroId/grupos` |
| Desasignar grupo | DELETE | `/director/maestros/desasignar-grupo/:maestroId/:grupoId` |
| Registrar maestro | POST | `/personas/registro-maestro` |
| Carga masiva (alumnos/maestros) | POST | `/director/carga-masiva` |
| Listar maestros | GET | `/director/maestros` |
| Listar alumnos | GET | `/director/alumnos` |
| Cambiar grupo de alumno | PATCH | `/director/alumnos/:id` |

Todas las rutas requieren **JWT** en el header: `Authorization: Bearer <token>`.

---

## 10. Ejemplo PATCH: editar grupo y asignar maestros

```bash
# Editar nombre y asignar maestros 5 y 7 al grupo 1
curl -X PATCH http://localhost:3000/director/grupos/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"A1","maestroIds":[5,7]}'

# Solo asignar un maestro
curl -X PATCH http://localhost:3000/director/grupos/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maestroIds":[5]}'

# Quitar todos los maestros del grupo
curl -X PATCH http://localhost:3000/director/grupos/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maestroIds":[]}'
```
