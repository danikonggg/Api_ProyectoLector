# API Libros – Guía para Frontend

Documento para el equipo de front. Solo lo necesario para consumir la API de libros.

---

## Base URL y autenticación

- **Base URL**: `http://localhost:3000` (o la que use el backend en tu entorno).
- **Libros**: todos los endpoints exigen **JWT de admin**.
- **Header**: `Authorization: Bearer <access_token>`.

El `access_token` se obtiene con `POST /auth/login` (email + password de un admin).

---

## Endpoints

| Acción | Método | Ruta | Auth |
|--------|--------|------|------|
| Login (admin) | `POST` | `/auth/login` | No |
| Cargar libro | `POST` | `/libros/cargar` | Sí (admin) |
| Listar libros | `GET` | `/libros` | Sí (admin) |
| Ver libro (unidades + segmentos) | `GET` | `/libros/:id` | Sí (admin) |

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

## 2. Cargar libro

**`POST /libros/cargar`**

- **Content-Type**: `multipart/form-data`
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
  "description": "Se extrajeron 42 segmentos de 15 páginas. Estado: listo.",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "materiaId": null,
    "codigo": "LIB-1735123456-abc12345",
    "grado": 5,
    "descripcion": "Libro de lectura",
    "estado": "listo",
    "numPaginas": 15,
    "materia": null,
    "unidades": []
  }
}
```

**UX sugerida**: Mostrar “Procesando…” mientras la petición está en curso. Al terminar, el libro ya viene “listo”; no hay que hacer otra llamada para “procesar”.

---

## 3. Listar libros

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

Sirve para grids, listas, etc.

---

## 4. Obtener libro (unidades + segmentos)

**`GET /libros/:id`**

- **Headers**: `Authorization: Bearer <access_token>`
- **Params**: `id` = ID del libro (número).

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

## Resumen rápido para integración

1. **Login**  
   `POST /auth/login` con `{ email, password }` → guardar `access_token`.

2. **Cargar libro**  
   `POST /libros/cargar` con `multipart/form-data`:  
   - `pdf` (file), `titulo` (string), `grado` (number) obligatorios.  
   - `descripcion`, `codigo`, `materiaId` opcionales (ahora solo lectura, se puede omitir materia).  
   - Header `Authorization: Bearer <token>`.  
   - Mostrar “Procesando…” mientras dura la petición.

3. **Listar**  
   `GET /libros` con `Authorization: Bearer <token>` → usar `data` para listas/grids.

4. **Ver contenido**  
   `GET /libros/:id` con `Authorization: Bearer <token>` → usar `data.unidades` y `data.unidades[].segmentos` para mostrar el texto del libro. Tras cargar un libro, usa el `data.id` de la respuesta y llama a este endpoint para obtener unidades y segmentos.

---

## Documentación interactiva (Swagger)

Si el backend expone Swagger:

- **URL**: `http://localhost:3000/api` (o la base URL del backend + `/api`).
- Ahí se pueden probar login, cargar, listar y obtener por id con el token.

---

**Última actualización**: Libros de lectura sin materia (testing). Solo backend; la UI la implementa el front consumiendo estos endpoints.
