# Documentación de Autenticación — ApiLector
**Para el equipo de Frontend**

Base URL: `https://tu-api.onrender.com`

---

## Índice
1. [Login](#1-login)
2. [Renovar sesión (Refresh Token)](#2-renovar-sesión-refresh-token)
3. [Cómo usar el access token](#3-cómo-usar-el-access-token)
4. [Recuperar contraseña](#4-recuperar-contraseña)
5. [Restablecer contraseña](#5-restablecer-contraseña)
6. [Flujo completo — Diagramas](#6-flujo-completo--diagramas)
7. [Manejo de errores](#7-manejo-de-errores)

---

## 1. Login

**`POST /auth/login`**

Inicia sesión y devuelve un `access_token` (corto) y un `refresh_token` (largo).

### Request

```json
{
  "email": "usuario@ejemplo.com",
  "password": "miContraseña123",
  "rememberMe": true
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `email` | string | ✅ | Correo del usuario |
| `password` | string | ✅ | Mínimo 6 caracteres |
| `rememberMe` | boolean | ❌ | `true` = refresh token dura 50 días. `false` (default) = dura 2 días |

### Response `200 OK`

```json
{
  "message": "Login exitoso",
  "description": "Usuario autenticado correctamente...",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": "2d",
  "refresh_expires_in": "50d",
  "remember_me": true,
  "user": {
    "id": 1,
    "nombre": "Juan",
    "apellidoPaterno": "Pérez",
    "apellidoMaterno": "García",
    "email": "usuario@ejemplo.com",
    "tipoPersona": "alumno"
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `access_token` | Úsalo en cada petición autenticada. Dura **2 días** |
| `refresh_token` | Úsalo para renovar el `access_token` sin pedir contraseña. Dura **2 días** (sin rememberMe) o **50 días** (con rememberMe) |
| `tipoPersona` | Puede ser: `alumno`, `maestro`, `director`, `administrador`, `padre` |
 
### Errores

| Status | Mensaje | Causa |
|--------|---------|-------|
| `401` | Credenciales inválidas | Email o contraseña incorrectos |
| `401` | Usuario inactivo | La cuenta está desactivada |
| `401` | Tu escuela no está activa | La escuela del usuario está inactiva o suspendida |
| `429` | Too Many Requests | Más de 5 intentos por minuto desde la misma IP |

---

## 2. Renovar sesión (Refresh Token)

**`POST /auth/refresh`**

Cuando el `access_token` expire, usa el `refresh_token` para obtener uno nuevo **sin pedirle la contraseña al usuario**.

### Request

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Response `200 OK`

```json
{
  "message": "Token renovado exitosamente",
  "description": "Sesión renovada. Se emite nuevo access_token y refresh_token.",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": "2d",
  "refresh_expires_in": "50d",
  "remember_me": true
}
```

> ⚠️ Cada vez que llames a `/auth/refresh` recibirás un **nuevo** `refresh_token`. Guarda siempre el más reciente y descarta el anterior.

### Errores

| Status | Mensaje | Causa |
|--------|---------|-------|
| `401` | Refresh token inválido o expirado | El token expiró o es incorrecto |
| `401` | Usuario no autorizado para refrescar sesión | El usuario fue desactivado desde que se emitió el token |

---

## 3. Cómo usar el access token

En **todas** las peticiones a endpoints protegidos, envía el `access_token` en el header `Authorization`:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Ejemplo con fetch

```js
const response = await fetch('https://tu-api.onrender.com/libros', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  },
});
```

### Estrategia recomendada para manejar tokens

```js
// 1. Al hacer login, guarda ambos tokens
localStorage.setItem('access_token', data.access_token);
localStorage.setItem('refresh_token', data.refresh_token);

// 2. Si recibes 401 en cualquier petición, intenta refrescar
if (response.status === 401) {
  const refreshRes = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: localStorage.getItem('refresh_token')
    }),
  });

  if (refreshRes.ok) {
    const tokens = await refreshRes.json();
    // Actualiza los tokens guardados
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    // Reintenta la petición original con el nuevo access_token
  } else {
    // El refresh también falló → mandar al login
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

---

## 4. Recuperar contraseña

**`POST /auth/forgot-password`**

El usuario ingresa su correo y recibirá un email con un enlace para restablecer su contraseña.

### Request

```json
{
  "email": "usuario@ejemplo.com"
}
```

### Response `200 OK`

```json
{
  "message": "Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña."
}
```

> ℹ️ La respuesta es siempre la misma, exista o no el correo. Esto es intencional por seguridad — así no se puede saber qué correos están registrados.

### Lo que recibe el usuario en su correo

Un botón con un enlace así:
```
https://tu-frontend.com/reset-password?token=a1b2c3d4e5f6...
```

El token **expira en 1 hora**.

### Errores

| Status | Mensaje | Causa |
|--------|---------|-------|
| `429` | Too Many Requests | Más de 3 intentos por minuto |

---

## 5. Restablecer contraseña

**`POST /auth/reset-password`**

Recibe el token del enlace del email y la nueva contraseña elegida por el usuario.

### Request

```json
{
  "token": "a1b2c3d4e5f6...",
  "nuevaPassword": "MiNuevaContraseña123"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `token` | string | ✅ | El token que viene en el parámetro `?token=` de la URL |
| `nuevaPassword` | string | ✅ | Mínimo 6, máximo 100 caracteres |

### Response `200 OK`

```json
{
  "message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión."
}
```

### Errores

| Status | Mensaje | Causa |
|--------|---------|-------|
| `400` | El token es inválido o ya fue utilizado | El token no existe (ya se usó o es incorrecto) |
| `400` | El token ha expirado. Solicita uno nuevo | Pasó más de 1 hora desde que se generó |
| `429` | Too Many Requests | Más de 5 intentos por minuto |

---

## 6. Flujo completo — Diagramas

### Flujo de Login con Refresh Token

```
Usuario                 Frontend                   API
  |                        |                         |
  |-- email + password --→ |                         |
  |   (+ rememberMe?)      |-- POST /auth/login --→  |
  |                        |                         |-- valida credenciales
  |                        |                         |-- genera access_token (2d)
  |                        |                         |-- genera refresh_token (2d o 50d)
  |                        | ←-- access_token -----  |
  |                        |     refresh_token        |
  |                        |     user info            |
  |                        |                         |
  |  (2 días después)      |                         |
  |                        |-- GET /libros ----------→|
  |                        |   Authorization: Bearer  |
  |                        | ←-- 401 Unauthorized --- |
  |                        |                         |
  |                        |-- POST /auth/refresh --→ |
  |                        |   { refresh_token }      |-- valida refresh_token
  |                        |                         |-- genera nuevos tokens
  |                        | ←-- nuevo access_token   |
  |                        |     nuevo refresh_token  |
  |                        |                         |
  |                        |-- GET /libros ----------→| (con nuevo access_token)
  |                        | ←-- 200 OK ------------ |
```

### Flujo de Recuperación de Contraseña

```
Usuario                 Frontend                   API              Email
  |                        |                         |                 |
  |-- "Olvidé contraseña"→ |                         |                 |
  |   ingresa su email     |-- POST /auth/--------→  |                 |
  |                        |   forgot-password        |                 |
  |                        |                         |-- genera token  |
  |                        |                         |-- guarda token  |
  |                        |                         |-- envía email --→|
  |                        | ←-- 200 OK ------------ |                 |
  |                        |                         |          ←-- enlace con token
  |←-- "Revisa tu correo"  |                         |                 |
  |                        |                         |                 |
  |  (hace clic en enlace del email)                  |                 |
  |                        |                         |                 |
  |-- nueva contraseña --→ |                         |                 |
  |                        |-- POST /auth/----------→|                 |
  |                        |   reset-password         |-- valida token  |
  |                        |   { token,               |-- valida expiry |
  |                        |     nuevaPassword }      |-- actualiza pwd |
  |                        |                         |-- borra token   |
  |                        | ←-- 200 OK ------------ |                 |
  |←-- "Contraseña lista"  |                         |                 |
  |    (redirige a login)  |                         |                 |
```

---

## 7. Manejo de errores

Todos los errores tienen este formato:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": ["El correo debe tener un formato válido"],
  "timestamp": "2026-05-19T03:58:58.378Z",
  "path": "/auth/login"
}
```

> `message` siempre es un array. Puede tener uno o varios mensajes de validación.

### Códigos relevantes

| Status | Significado | Qué hacer en el frontend |
|--------|-------------|--------------------------|
| `200` | OK | Operación exitosa |
| `400` | Bad Request | Mostrar `message[0]` al usuario |
| `401` | Unauthorized | Mostrar `message[0]`. Si es en petición autenticada, intentar refresh |
| `409` | Conflict | Email ya registrado u otro conflicto |
| `429` | Too Many Requests | Mostrar "Demasiados intentos, espera un momento" |
| `500` | Server Error | Mostrar mensaje genérico, no exponer detalles |

---

## Páginas/vistas que necesita el frontend

| Vista | Descripción |
|-------|-------------|
| `/login` | Formulario email + password + checkbox "Recordarme" → llama a `POST /auth/login` |
| `/forgot-password` | Formulario con solo el email → llama a `POST /auth/forgot-password` |
| `/reset-password?token=...` | Formulario con nueva contraseña + confirmar contraseña → lee `token` de la URL y llama a `POST /auth/reset-password` |
