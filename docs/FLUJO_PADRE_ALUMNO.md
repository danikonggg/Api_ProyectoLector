# 📋 Flujo Padre–Alumno

Documentación del flujo completo para registrar padres/tutores y alumnos, y gestionar su relación.

---

## 🎯 Resumen rápido

| Opción | Endpoint | Cuándo usarlo |
|--------|----------|---------------|
| **Padre + Hijo juntos** | `POST /personas/registro-padre-con-hijo` | Tienes todos los datos de padre e hijo a la vez |
| **Solo alumno** | `POST /personas/registro-alumno` | Registrar alumno sin padre o con padre existente |
| **Alumno + Padre automático** | `POST /personas/registro-alumno` con `crearPadreAutomatico: true` | Registrar alumno y crear padre temporal; completar datos después |
| **Solo padre** | `POST /personas/registro-padre` | Crear padre sin hijos (para vincular después) |
| **Completar padre** | `PUT /personas/padres/:id` | Completar datos de un padre creado automáticamente |

---

## 📊 Diagrama de flujo

```
                    ¿Cómo quieres registrar?

    ┌─────────────────────┬──────────────────────┬──────────────────────────┐
    │                     │                      │                          │
    ▼                     ▼                      ▼                          ▼
┌─────────────┐    ┌──────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ Padre +     │    │ Solo alumno  │    │ Alumno + Padre     │    │ Solo padre      │
│ Hijo juntos │    │ (con/sin     │    │ automático         │    │                 │
│             │    │  padre)      │    │                    │    │                 │
└──────┬──────┘    └──────┬───────┘    └─────────┬──────────┘    └────────┬────────┘
       │                  │                      │                        │
       │                  │                      │                        │
       ▼                  ▼                      ▼                        ▼
registro-padre-    registro-alumno        registro-alumno            registro-padre
con-hijo           + padreId?             + crearPadreAutomatico
       │                  │                      │                        │
       │                  │                      │                        │
       ▼                  ▼                      └────────────┬───────────┘
   Creados ambos         Listo                               │
   y vinculados                                              ▼
                                                    Padre con datos
                                                    temporales (@temp.local)
                                                           │
                                                           ▼
                                                    GET /personas/padres
                                                    (aparece como "Pendiente")
                                                           │
                                                           ▼
                                                    PUT /personas/padres/:id
                                                    Completar nombre, email, etc.
                                                           │
                                                           ▼
                                                    Dar credenciales al tutor
```

---

## 1️⃣ Registrar padre e hijo juntos

**Cuándo:** Tienes todos los datos de padre e hijo a la vez.

```
POST /personas/registro-padre-con-hijo
Authorization: Bearer <token_admin>
```

**Body:**
```json
{
  "padre": {
    "nombre": "María",
    "apellidoPaterno": "López",
    "apellidoMaterno": "Martínez",
    "email": "maria@example.com",
    "password": "password123",
    "telefono": "5551234567"
  },
  "hijo": {
    "nombre": "Carlos",
    "apellidoPaterno": "López",
    "apellidoMaterno": "Martínez",
    "email": "carlos@example.com",
    "password": "password123",
    "idEscuela": 1,
    "grado": 5,
    "grupo": "A",
    "telefono": "5559876543"
  }
}
```

**Resultado:** Padre e hijo creados y vinculados. Ambos pueden iniciar sesión de inmediato.

---

## 2️⃣ Registrar solo alumno

**Cuándo:** Registrar alumno sin padre, o vincularlo a un padre ya existente.

```
POST /personas/registro-alumno
Authorization: Bearer <token_admin_o_director>
```

**Body (sin padre):**
```json
{
  "nombre": "Ana",
  "apellidoPaterno": "García",
  "apellidoMaterno": "Sánchez",
  "email": "ana@example.com",
  "password": "password123",
  "idEscuela": 1,
  "grado": 3,
  "grupo": "B"
}
```

**Body (con padre existente):**
```json
{
  "nombre": "Ana",
  "apellidoPaterno": "García",
  "apellidoMaterno": "Sánchez",
  "email": "ana@example.com",
  "password": "password123",
  "idEscuela": 1,
  "padreId": 2,
  "grado": 3,
  "grupo": "B"
}
```

---

## 3️⃣ Registrar alumno + padre automático

**Cuándo:** No tienes los datos del padre aún. Creas el alumno y un “padre temporal” que completas después.

```
POST /personas/registro-alumno
Authorization: Bearer <token_admin_o_director>
```

**Body:**
```json
{
  "nombre": "Luis",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "Hernández",
  "email": "luis@example.com",
  "password": "password123",
  "idEscuela": 1,
  "crearPadreAutomatico": true,
  "grado": 4,
  "grupo": "A"
}
```

**Resultado:**
- Alumno creado ✅
- Padre creado con datos temporales (email `padre_pendiente_xxx@temp.local`, nombre "Pendiente - Completar datos") ✅
- Alumno vinculado al padre ✅

**Respuesta incluye:**
```json
{
  "data": {
    "padreCreadoAutomatico": {
      "id": 5,
      "email": "padre_pendiente_1738xxx_abc123@temp.local",
      "password": "xyz789abc"
    },
    "mensajePadre": "Padre creado con datos temporales. Ve a Alumnos y Padres > Padres para completar sus datos."
  }
}
```

**Siguiente paso:** Ir a **Alumnos y Padres > Padres**, localizar el padre con badge "Pendiente" y usar **Completar datos**.

---

## 4️⃣ Registrar solo padre

**Cuándo:** Crear un padre sin hijos (para vincular después al registrar alumnos).

```
POST /personas/registro-padre
Authorization: Bearer <token_admin>
```

**Body:**
```json
{
  "nombre": "Roberto",
  "apellidoPaterno": "Díaz",
  "apellidoMaterno": "López",
  "email": "roberto@example.com",
  "password": "password123",
  "telefono": "5551112233"
}
```

---

## 5️⃣ Completar datos del padre (padres temporales)

**Cuándo:** El padre fue creado con `crearPadreAutomatico` y quieres darle credenciales reales al tutor.

```
PUT /personas/padres/:id
Authorization: Bearer <token_admin>
```

**Body:**
```json
{
  "nombre": "Roberto",
  "apellido": "Díaz López",
  "email": "roberto.real@example.com",
  "password": "nuevaPassword123",
  "telefono": "5551112233"
}
```

- `nombre`, `apellido`, `email`: obligatorios para poder usar el sistema.
- `password`: opcional; si lo envías, se actualiza la contraseña.
- `telefono`: opcional.

**Resultado:** El padre puede iniciar sesión con el nuevo email y contraseña. Ya no aparece como "Pendiente".

---

## 6️⃣ Consultar alumnos y padres

### Listar alumnos
```
GET /personas/alumnos
GET /personas/alumnos?escuelaId=1
Authorization: Bearer <token_admin_o_director>
```
- Admin: todos los alumnos; opcional `?escuelaId=X`.
- Director: solo alumnos de su escuela.

### Ver alumno por ID
```
GET /personas/alumnos/:id
Authorization: Bearer <token_admin_o_director>
```
Incluye `padre` si tiene.

### Ver padre de un alumno
```
GET /personas/alumnos/:id/padre
Authorization: Bearer <token_admin_o_director>
```
Devuelve el padre o `data: null` si no tiene.

### Listar padres
```
GET /personas/padres
Authorization: Bearer <token_admin>
```
Incluye `pendiente: true` para padres con datos temporales.

### Ver padre por ID
```
GET /personas/padres/:id
Authorization: Bearer <token_admin>
```

### Ver hijos de un padre
```
GET /personas/padres/:id/alumnos
Authorization: Bearer <token_admin>
```

### Alumnos de una escuela (incluye padre)
```
GET /escuelas/:id/alumnos
Authorization: Bearer <token_admin_o_director>
```

---

## 📱 Flujo en el frontend

### Admin – Usuarios

| Pestaña | Acción |
|---------|--------|
| **Padre + Hijo** | Formulario único: datos del padre y del hijo. Registrar ambos vinculados. |
| **Solo padre** | Solo datos del padre. |
| **Solo alumno** | Datos del alumno. Opciones: Padre existente (selector) o **Crear padre automático**. |
| **Maestro** / **Director** | Registros independientes. |

### Admin – Alumnos y Padres

| Pestaña | Acción |
|---------|--------|
| **Alumnos** | Lista con filtro por escuela. Cada alumno muestra su padre (si tiene). Ver detalle por alumno. |
| **Padres** | Lista de padres. Padres **Pendiente** tienen botón "Completar datos". Formulario para nombre, apellido, email, contraseña. |

### Director

- Registrar alumno con opción **"Crear padre automático"**.
- El admin completa los datos del padre después en Alumnos y Padres.

---

## ✅ Validaciones

- `crearPadreAutomatico` y `padreId` son excluyentes. Si usas `crearPadreAutomatico: true`, no envíes `padreId`.
- Un padre pendiente tiene email `@temp.local` y aparece con `pendiente: true` en `GET /personas/padres`.
- Al completar con `PUT /personas/padres/:id`, el email debe ser único en el sistema.
- Director solo puede registrar alumnos (y crear padres automáticos) en su escuela.

---

**Última actualización:** Febrero 2025
