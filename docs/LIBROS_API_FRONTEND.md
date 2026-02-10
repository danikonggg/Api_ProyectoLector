# API Libros – Guía para Frontend

Documento para el equipo de front. Solo lo necesario para consumir la API de libros.

---

## Base URL y autenticación

- **Base URL**: `http://localhost:3000` (o la que use el backend en tu entorno).
- **Header**: `Authorization: Bearer <access_token>`.

El `access_token` se obtiene con `POST /auth/login` (email + password).

---

## Endpoints

| Acción | Método | Ruta | Auth |
|--------|--------|------|------|
| Login | `POST` | `/auth/login` | No |
| Mis libros (alumno) | `GET` | `/escuelas/mis-libros` | Sí (alumno) |
| Cargar libro | `POST` | `/libros/cargar` | Sí (admin) |
| Listar libros | `GET` | `/libros` | Sí (admin) |
| Ver libro (unidades + segmentos) | `GET` | `/libros/:id` | Sí (admin, director, alumno*) |
| Descargar PDF del libro | `GET` | `/libros/:id/pdf` | Sí (solo admin) |
| Eliminar libro | `DELETE` | `/libros/:id` | Sí (admin) |

\* Alumno: solo libros asignados a su escuela. Director: libros de su escuela.

Para rutas **solo admin** y ejemplos de código en el front de prueba, ver [RUTAS_LIBROS_ADMIN_FRONTEND.md](./RUTAS_LIBROS_ADMIN_FRONTEND.md). Para **director** (libros de mi escuela sin enviar id), ver [RUTAS_DIRECTOR_FRONTEND.md](./RUTAS_DIRECTOR_FRONTEND.md).

---

## 1. Login

**`POST /auth/login`**

- **Content-Type**: `application/json`
- **Body**:
```json
{
  "email": "admin@example.com",
  "password": "tu_password"
}
```

- **Respuesta 200**:
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "24h",
  "user": {
    "id": 1,
    "nombre": "Admin",
    "apellido": "Sistema",
    "email": "admin@example.com",
    "tipoPersona": "administrador"
  }
}
```

Guardar `access_token` y usarlo en el header `Authorization: Bearer <access_token>` para todo lo de libros.

---

## 2. Mis libros (solo alumnos)

**`GET /escuelas/mis-libros`**

- **Headers**: `Authorization: Bearer <access_token>`
- **Requiere**: Usuario autenticado como **alumno**.

**Respuesta 200**:
```json
{
  "message": "Libros obtenidos correctamente",
  "data": [
    {
      "id": 1,
      "titulo": "El principito",
      "grado": 5,
      "descripcion": "Libro de lectura",
      "codigo": "LIB-1735123456-abc12345"
    }
  ]
}
```

Sirve para mostrar la biblioteca digital del alumno: libros asignados a la escuela donde estudia.

**Errores:** 401 (no autenticado), 403 (solo alumnos).

---

## 3. Cargar libro

**`POST /libros/cargar`**

- **Body**: `multipart/form-data`. No enviar header `Content-Type`; el navegador lo pone con el boundary.
- **Headers**: `Authorization: Bearer <access_token>`

**Campos del form:**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `pdf` | File | Sí | Archivo PDF (máx. 50 MB) |
| `titulo` | string | Sí | Título del libro (máx. 150 caracteres) |
| `grado` | number | Sí | Grado escolar |
| `descripcion` | string | No | Descripción (máx. 255) |
| `codigo` | string | No | Código único. Si no se envía, el backend genera uno |
| `materiaId` | number | No | Por ahora **solo libros de lectura**; se puede omitir |

**Ejemplo en JS (fetch):**
```js
const form = new FormData();
form.append('pdf', fileInput.files[0]);
form.append('titulo', 'El principito');
form.append('grado', 5);
form.append('descripcion', 'Libro de lectura');

const res = await fetch('/libros/cargar', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: form,
});
```

**Respuesta 201** (libro ya procesado, estado `listo`):
```json
{
  "message": "Libro cargado y procesado correctamente.",
  "description": "Se extrajeron 42 segmentos de 15 páginas. PDF guardado en pdfs/.... Estado: listo.",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "materiaId": null,
    "codigo": "LIB-1735123456-abc12345",
    "grado": 5,
    "descripcion": "Libro de lectura",
    "estado": "listo",
    "numPaginas": 15,
    "rutaPdf": "pdfs/LIB-1735123456-abc12345_1.pdf",
    "materia": null,
    "unidades": []
  }
}
```

**UX sugerida**: Mostrar “Procesando…” mientras la petición está en curso. Al terminar, el libro ya viene “listo”; no hay que hacer otra llamada para “procesar”.

---

## 4. Listar libros

**`GET /libros`**

- **Headers**: `Authorization: Bearer <access_token>`

**Respuesta 200**:
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
    },
    {
      "id": 2,
      "titulo": "Don Quijote",
      "materiaId": null,
      "codigo": "LIB-1735123457-def67890",
      "grado": 6,
      "descripcion": null,
      "estado": "listo",
      "numPaginas": 120,
      "materia": null
    }
  ]
}
```

Sirve para grids, listas, etc. Cada libro puede incluir `rutaPdf` si tiene PDF almacenado (ej. `pdfs/COD_1.pdf`).

---

## 5. Descargar PDF del libro

**`GET /libros/:id/pdf`**

- **Headers**: `Authorization: Bearer <access_token>`
- **Params**: `id` = ID del libro.
- **Requiere**: **Solo administrador.**

**Respuesta 200**: el cuerpo es el archivo PDF (`Content-Type: application/pdf`). Se puede usar como enlace de descarga o abrir en nueva pestaña.

**Errores:** 401 (no autenticado), 403 (no es admin), 404 (libro o PDF no encontrado).

---

## 6. Obtener libro (unidades + segmentos)

**`GET /libros/:id`**

- **Headers**: `Authorization: Bearer <access_token>`
- **Params**: `id` = ID del libro (número).
- **Alumno:** Solo puede ver libros asignados a su escuela. Si intenta acceder a un libro de otra escuela → 403.

**Respuesta 200**:
```json
{
  "message": "Libro obtenido correctamente.",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "materiaId": null,
    "codigo": "LIB-1735123456-abc12345",
    "grado": 5,
    "descripcion": "Libro de lectura",
    "estado": "listo",
    "numPaginas": 15,
    "rutaPdf": "pdfs/LIB-1735123456-abc12345_1.pdf",
    "materia": null,
    "unidades": [
      {
        "id": 1,
        "libroId": 1,
        "nombre": "Unidad 1",
        "orden": 1,
        "segmentos": [
          {
            "id": 1,
            "libroId": 1,
            "unidadId": 1,
            "contenido": "Cuando yo tenía seis años vi una vez una lámina magnífica...",
            "numeroPagina": 1,
            "orden": 1,
            "idExterno": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          },
          {
            "id": 2,
            "contenido": "Y así llegó a conocer al principito...",
            "numeroPagina": 2,
            "orden": 2,
            "idExterno": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
          }
        ]
      }
    ]
  }
}
```

- **`unidades`**: ordenadas por `orden`.
- **`segmentos`**: dentro de cada unidad, ordenados por `orden`.
- **`contenido`**: texto del fragmento (~100–200 palabras) para mostrar en pantalla.
- **`idExterno`**: UUID estable para identificar el segmento (p. ej. progreso, analytics).

El front solo debe leer y mostrar `data.unidades` y `data.unidades[].segmentos`; no hay lógica de IA ni de procesamiento en tiempo real.

---

## 7. Eliminar libro

**`DELETE /libros/:id`**

- **Headers**: `Authorization: Bearer <access_token>`
- **Params**: `id` = ID del libro.
- **Requiere**: **Admin**.

Elimina el libro por completo: asignaciones a escuelas, archivo PDF, unidades y segmentos.

**Respuesta 200:** Libro eliminado.

**Errores:** 401, 403 (no es administrador), 404 (libro no encontrado).

---

## Errores habituales

| Código | Causa | Acción en frontend |
|--------|-------|---------------------|
| **401** | Sin token o token inválido/expirado | Redirigir a login, pedir de nuevo `access_token` |
| **403** | Usuario no es admin | Mensaje tipo “Solo administradores pueden acceder” |
| **400** “Debes enviar un archivo PDF” | No se envió `pdf` o el campo no se llama `pdf` | Verificar que el file vaya en el campo `pdf` del form |
| **400** “Solo se permiten archivos PDF” | Archivo no es PDF | Validar tipo/extension antes de enviar |
| **400** “Faltan metadatos: titulo, grado” | Falta `titulo` o `grado` en el form | Validar formulario antes de enviar |
| **404** “No se encontró el libro con ID X” | `id` incorrecto o libro borrado | Mensaje “Libro no encontrado” y/o volver al listado |
| **409** “Ya existe un libro con ese código” | `codigo` duplicado | Pedir otro código o no enviar `codigo` |

---

## Escuela – Libros (doble verificación)

- **Admin:** Otorga libro a una escuela: `POST /escuelas/:id/libros` (body: `{ "codigo": "LIB-..." }`). Listar libros de una escuela: `GET /escuelas/:id/libros`, pendientes: `GET /escuelas/:id/libros/pendientes`. El `id` es el ID de la escuela.
- **Director:** Ve y canjea libros **de su escuela sin enviar id**: `GET /director/libros`, `GET /director/libros/pendientes`, `POST /director/canjear-libro` (body: `{ "codigo": "LIB-..." }`). Ver [RUTAS_DIRECTOR_FRONTEND.md](./RUTAS_DIRECTOR_FRONTEND.md).
- Flujo: Admin otorga → Director canjea con el código. Detalle en [FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md).

---

## Resumen rápido para integración

1. **Login**  
   `POST /auth/login` con `{ email, password }` → guardar `access_token`.

2. **Alumno – Biblioteca digital**  
   `GET /escuelas/mis-libros` con `Authorization: Bearer <token>` → listar libros de la escuela del alumno. Luego `GET /libros/:id` para contenido y `GET /libros/:id/pdf` para descargar (solo libros de su escuela).

3. **Cargar libro** (admin)  
   `POST /libros/cargar` con `multipart/form-data`:  
   - `pdf` (file), `titulo` (string), `grado` (number) obligatorios.  
   - `descripcion`, `codigo`, `materiaId` opcionales (ahora solo lectura, se puede omitir materia).  
   - Header `Authorization: Bearer <token>`.  
   - Mostrar “Procesando…” mientras dura la petición.

4. **Listar** (admin)  
   `GET /libros` con `Authorization: Bearer <token>` → usar `data` para listas/grids.

5. **Ver contenido**  
   `GET /libros/:id` con `Authorization: Bearer <token>` → usar `data.unidades` y `data.unidades[].segmentos` para mostrar el texto del libro. Admin y director: cualquier libro. Alumno: solo libros de su escuela.

6. **Eliminar libro** (admin)  
   `DELETE /libros/:id` con `Authorization: Bearer <token>`.

---

## Documentación interactiva (Swagger)

Si el backend expone Swagger:

- **URL**: `http://localhost:3000/api` (o la base URL del backend + `/api`).
- Ahí se pueden probar login, cargar, listar y obtener por id con el token.

---

**Última actualización**: Febrero 2025. Descargar PDF (`GET /libros/:id/pdf`) solo administrador. Director usa `/director/libros` y `/director/canjear-libro` sin id de escuela. Alumnos: `GET /escuelas/mis-libros`, `GET /libros/:id` (solo libros de su escuela). Admin: cargar, listar, eliminar, otorgar a escuela. Ver [RUTAS_LIBROS_ADMIN_FRONTEND.md](./RUTAS_LIBROS_ADMIN_FRONTEND.md) para ejemplos de código.
