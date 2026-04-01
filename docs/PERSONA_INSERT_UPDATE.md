# Documentación: Inserción y actualización de Persona

Estructura de datos para registrar y actualizar personas. **Nombre** es un único campo; **apellidos** van separados en `apellidoPaterno` y `apellidoMaterno`.

---

## Estructura de Persona

| Campo             | Tipo     | Descripción                                |
|-------------------|----------|--------------------------------------------|
| `nombre`          | string   | Nombre único (máx. 100 caracteres)         |
| `apellidoPaterno` | string   | Apellido paterno (obligatorio)             |
| `apellidoMaterno` | string   | Apellido materno (opcional, puede ser null)|
| `correo` / `email`| string   | Correo electrónico                         |
| `telefono`        | string   | Teléfono (opcional)                        |
| `fechaNacimiento` | string   | Fecha YYYY-MM-DD (opcional)                |
| `genero`          | string   | Género (opcional)                          |
| `password`        | string   | Contraseña (mín. 6 caracteres)             |

---

## INSERT (Registro)

### POST /auth/registro-admin

Registrar administrador (máx. 5).

| Campo             | Obligatorio | Descripción                |
|-------------------|-------------|----------------------------|
| `nombre`          | Sí          | Nombre                     |
| `apellidoPaterno` | Sí          | Apellido paterno           |
| `apellidoMaterno` | Sí          | Apellido materno           |
| `email`           | Sí          | Correo (único)             |
| `password`        | Sí          | Mín. 6 caracteres          |
| `telefono`        | No          | Teléfono                   |
| `fechaNacimiento` | No          | YYYY-MM-DD                 |
| `nivel`           | No          | Nivel de administrador     |

**Ejemplo:**
```json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "admin@example.com",
  "password": "password123",
  "telefono": "5551234567",
  "fechaNacimiento": "1990-05-15"
}
```

---

### POST /personas/registro-padre

Registrar padre o tutor.

| Campo             | Obligatorio | Descripción        |
|-------------------|-------------|--------------------|
| `nombre`          | Sí          | Nombre             |
| `apellidoPaterno` | Sí          | Apellido paterno   |
| `apellidoMaterno` | Sí          | Apellido materno   |
| `email`           | Sí          | Correo (único)     |
| `password`        | Sí          | Mín. 6 caracteres  |
| `telefono`        | No          | Teléfono           |
| `fechaNacimiento` | No          | YYYY-MM-DD         |
| `alumnoId`        | No          | ID alumno a vincular |

**Ejemplo:**
```json
{
  "nombre": "María",
  "apellidoPaterno": "López",
  "apellidoMaterno": "Martínez",
  "email": "padre@example.com",
  "password": "password123",
  "telefono": "5559876543",
  "alumnoId": 1
}
```

---

### POST /personas/registro-alumno

Registrar alumno.

| Campo             | Obligatorio | Descripción            |
|-------------------|-------------|------------------------|
| `nombre`          | Sí          | Nombre                 |
| `apellidoPaterno` | Sí          | Apellido paterno       |
| `apellidoMaterno` | Sí          | Apellido materno       |
| `email`           | Sí          | Correo (único)         |
| `password`        | Sí          | Mín. 6 caracteres      |
| `idEscuela`       | Admin: Sí / Director: No | ID de escuela |
| `telefono`        | No          | Teléfono               |
| `fechaNacimiento` | No          | YYYY-MM-DD             |
| `grado`           | No          | Grado escolar (1-6)    |
| `grupo`           | No          | Grupo o sección        |
| `cicloEscolar`    | No          | Ej. 2024-2025          |

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
  "telefono": "5555555555",
  "cicloEscolar": "2024-2025"
}
```

---

### POST /personas/registro-maestro

Registrar maestro.

| Campo             | Obligatorio | Descripción            |
|-------------------|-------------|------------------------|
| `nombre`          | Sí          | Nombre                 |
| `apellidoPaterno` | Sí          | Apellido paterno       |
| `apellidoMaterno` | Sí          | Apellido materno       |
| `email`           | Sí          | Correo (único)         |
| `password`        | Sí          | Mín. 6 caracteres      |
| `idEscuela`       | Admin: Sí / Director: No | ID de escuela |
| `telefono`        | No          | Teléfono               |
| `especialidad`    | No          | Especialidad o materia |
| `fechaIngreso`    | No          | YYYY-MM-DD             |

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

### POST /personas/registro-director

Registrar director.

| Campo             | Obligatorio | Descripción  |
|-------------------|-------------|--------------|
| `nombre`          | Sí          | Nombre       |
| `apellidoPaterno` | Sí          | Apellido paterno |
| `apellidoMaterno` | Sí          | Apellido materno |
| `email`           | Sí          | Correo (único)   |
| `password`        | Sí          | Mín. 6 caracteres |
| `idEscuela`       | Sí          | ID de escuela    |
| `telefono`        | No          | Teléfono        |

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

## UPDATE (Actualización)

### PATCH /admin/usuarios/:id

Actualizar usuario (cualquier rol). Usa **ID de persona**. Todos los campos son opcionales.

| Campo             | Tipo    | Descripción                              |
|-------------------|---------|------------------------------------------|
| `nombre`          | string  | Nombre                                   |
| `apellidoPaterno` | string  | Apellido paterno                         |
| `apellidoMaterno` | string  | Apellido materno (vacío = null)          |
| `correo`          | string  | Correo (único si se cambia)              |
| `telefono`        | string  | Teléfono                                 |
| `fechaNacimiento` | string  | YYYY-MM-DD                               |
| `genero`          | string  | Género                                   |
| `password`        | string  | Nueva contraseña (mín. 6)                |
| `activo`          | boolean | Usuario activo o no                      |

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

### PATCH /personas/maestros/:id

Actualizar maestro. Usa **ID de maestro**. Body idéntico a `PATCH /admin/usuarios/:id`.

| Campo             | Tipo    | Descripción                              |
|-------------------|---------|------------------------------------------|
| `nombre`          | string  | Nombre                                   |
| `apellidoPaterno` | string  | Apellido paterno                         |
| `apellidoMaterno` | string  | Apellido materno                         |
| `correo`          | string  | Correo electrónico                       |
| `telefono`        | string  | Teléfono                                 |
| `fechaNacimiento` | string  | YYYY-MM-DD                               |
| `genero`          | string  | Género                                   |
| `password`        | string  | Nueva contraseña                         |
| `activo`          | boolean | Usuario activo o no                      |

**Ejemplo:**
```json
{
  "nombre": "Ana María",
  "apellidoPaterno": "Rodríguez",
  "apellidoMaterno": "Fernández",
  "correo": "ana.rodriguez@escuela.edu",
  "telefono": "5559876543",
  "activo": true
}
```

---

### PUT /personas/padres/:id

Actualizar padre. Usa **ID de padre**. Campos opcionales.

| Campo             | Tipo   | Descripción        |
|-------------------|--------|--------------------|
| `nombre`          | string | Nombre             |
| `apellidoPaterno` | string | Apellido paterno   |
| `apellidoMaterno` | string | Apellido materno   |
| `correo`          | string | Correo electrónico |
| `telefono`        | string | Teléfono           |
| `password`        | string | Nueva contraseña   |

**Ejemplo:**
```json
{
  "nombre": "María",
  "apellidoPaterno": "López",
  "apellidoMaterno": "Martínez",
  "correo": "maria.lopez@example.com",
  "telefono": "5558887766"
}
```

---

## Respuesta de Login

El usuario devuelto en `POST /auth/login` tiene esta forma:

```json
{
  "id": 1,
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "email": "usuario@example.com",
  "tipoPersona": "administrador"
}
```

---

## Resumen

| Operación | Endpoint                      | Campos de persona                          |
|-----------|-------------------------------|--------------------------------------------|
| Insert    | POST /auth/registro-admin     | nombre, apellidoPaterno, apellidoMaterno, email, password |
| Insert    | POST /personas/registro-padre | nombre, apellidoPaterno, apellidoMaterno, email, password |
| Insert    | POST /personas/registro-alumno| nombre, apellidoPaterno, apellidoMaterno, email, password, idEscuela |
| Insert    | POST /personas/registro-maestro | nombre, apellidoPaterno, apellidoMaterno, email, password, idEscuela |
| Insert    | POST /personas/registro-director | nombre, apellidoPaterno, apellidoMaterno, email, password, idEscuela |
| Update    | PATCH /admin/usuarios/:id     | nombre?, apellidoPaterno?, apellidoMaterno?, correo?, telefono?, etc. |
| Update    | PATCH /personas/maestros/:id  | nombre?, apellidoPaterno?, apellidoMaterno?, correo?, telefono?, etc. |
| Update    | PUT /personas/padres/:id      | nombre?, apellidoPaterno?, apellidoMaterno?, correo?, telefono?, password? |

*Última actualización: Febrero 2025*
