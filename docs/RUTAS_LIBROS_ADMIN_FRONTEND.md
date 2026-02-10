# Libros – Solo administrador (frontend)

Todas las rutas de libros que usa el **administrador**. Requieren **JWT**: `Authorization: Bearer <token>`.

**Base URL:** `http://localhost:3000` (o la de tu backend).

> Director y alumno usan otras rutas: [LIBROS_API_FRONTEND.md](./LIBROS_API_FRONTEND.md), [RUTAS_DIRECTOR_FRONTEND.md](./RUTAS_DIRECTOR_FRONTEND.md).

---

## Resumen rápido

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/libros` | Listar todos los libros |
| POST | `/libros/cargar` | Subir PDF + metadatos (FormData) |
| GET | `/libros/:id` | Ver detalle (unidades y segmentos) |
| GET | `/libros/:id/pdf` | Descargar PDF |
| DELETE | `/libros/:id` | Eliminar libro |
| GET | `/escuelas/:id/libros` | Libros activos de una escuela |
| GET | `/escuelas/:id/libros/pendientes` | Libros pendientes de canjear |
| POST | `/escuelas/:id/libros` | Otorgar libro a la escuela (body: `{ "codigo": "LIB-..." }`) |

---

## 1. Listar libros

**GET** `/libros`

- **Headers:** `Authorization: Bearer <token>`
- **Body:** ninguno

**Respuesta 200**

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
    }
  ]
}
```

Usar `data` para catálogo, grids o selector (el `codigo` sirve para otorgar a escuela).

**Errores:** 401, 403.

---

## 2. Cargar libro (subir PDF)

**POST** `/libros/cargar`

- **Headers:** `Authorization: Bearer <token>`. **No** enviar `Content-Type`; el navegador lo fija con el boundary.
- **Body:** `multipart/form-data`

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|--------|
| pdf | File | Sí | PDF, máx. 50 MB |
| titulo | string | Sí | Título del libro |
| grado | number | Sí | Grado escolar (ej. 5) |
| descripcion | string | No | Opcional |
| codigo | string | No | Si no se envía, el backend lo genera |
| materiaId | number | No | Opcional |

**Ejemplo (fetch)**

```js
const form = new FormData();
form.append('pdf', fileInput.files[0]);
form.append('titulo', titulo.trim());
form.append('grado', Number(grado) || 1);
if (descripcion?.trim()) form.append('descripcion', descripcion.trim());
if (codigo?.trim()) form.append('codigo', codigo.trim());

const res = await fetch(`${BASE_URL}/libros/cargar`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const json = await res.json(); // res.data tiene el libro creado
```

**Respuesta 201**

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

- **UX:** Mostrar “Procesando…” mientras la petición está en curso. Al terminar, el libro ya viene listo; no hace falta otra llamada.
- **Errores:** 400 (PDF inválido, sin texto o faltan `titulo`/`grado`), 401, 403.

---

## 3. Ver libro (detalle con unidades y segmentos)

**GET** `/libros/:id`

- **Headers:** `Authorization: Bearer <token>`
- **Params:** `id` = ID del libro (número)

**Respuesta 200:** Libro con `unidades` y, dentro de cada una, `segmentos` (bloques de texto). Ejemplo de estructura:

```json
{
  "message": "Libro obtenido correctamente.",
  "data": {
    "id": 1,
    "titulo": "El principito",
    "codigo": "LIB-1735123456-abc12345",
    "grado": 5,
    "estado": "listo",
    "numPaginas": 15,
    "unidades": [
      {
        "id": 1,
        "nombre": "Unidad 1",
        "orden": 1,
        "segmentos": [
          {
            "id": 1,
            "contenido": "Cuando yo tenía seis años vi una vez...",
            "numeroPagina": 1,
            "orden": 1,
            "idExterno": "uuid-opcional"
          }
        ]
      }
    ]
  }
}
```

**Errores:** 401, 403, 404.

---

## 4. Descargar PDF

**GET** `/libros/:id/pdf`

- **Headers:** `Authorization: Bearer <token>`
- **Params:** `id` = ID del libro

**Respuesta 200:** Archivo binario (`Content-Type: application/pdf`). Para descargar en el navegador:

```js
const res = await fetch(`${BASE_URL}/libros/${id}/pdf`, {
  headers: { Authorization: `Bearer ${token}` },
});
const blob = await res.blob();
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = `libro-${id}.pdf`;
a.click();
```

**Errores:** 401, 403, 404.

---

## 5. Eliminar libro

**DELETE** `/libros/:id`

- **Headers:** `Authorization: Bearer <token>`
- **Params:** `id` = ID del libro

Se elimina el libro por completo: asignaciones a escuelas, archivo PDF, unidades y segmentos.

**Respuesta 200:** `{ "message": "Libro ... eliminado correctamente de todo el sistema." }`

**Errores:** 401, 403, 404.

---

## 6. Libros de una escuela (activos y pendientes)

**GET** `/escuelas/:id/libros`  
Lista los libros ya canjeados/activos en esa escuela.

**GET** `/escuelas/:id/libros/pendientes`  
Lista los libros otorgados por el admin que el director aún no ha canjeado.

- **Headers:** `Authorization: Bearer <token>`
- **Params:** `id` = ID de la escuela

**Errores:** 401, 403, 404.

---

## 7. Otorgar libro a una escuela

**POST** `/escuelas/:id/libros`

Paso 1 del flujo: el admin asigna el libro a la escuela; después el director debe **canjear** con el código (desde su panel, sin enviar id de escuela).

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Params:** `id` = ID de la escuela
- **Body:**

```json
{
  "codigo": "LIB-1735123456-abc12345"
}
```

El `codigo` es el del libro (viene en listar libros o al cargar).

**Respuesta 201:** Libro otorgado; queda pendiente hasta que el director canjee.

**Errores:** 404 (escuela o libro no encontrado), 409 (libro ya otorgado o ya canjeado).

---

## Errores habituales (admin libros)

| Código | Causa | Qué hacer en front |
|--------|--------|---------------------|
| 401 | Sin token o token inválido/expirado | Redirigir a login |
| 403 | Usuario no es administrador | Mensaje “Solo administradores” |
| 400 | “Debes enviar un archivo PDF” | Enviar el file en el campo `pdf` del FormData |
| 400 | “Solo se permiten archivos PDF” | Validar tipo/extension antes de enviar |
| 400 | “Faltan metadatos: titulo, grado” | Validar formulario antes de enviar |
| 404 | Libro o escuela no encontrada | Mensaje “No encontrado” y volver al listado |
| 409 | En otorgar: libro ya otorgado o canjeado | Avisar y no permitir otorgar de nuevo |

---

## Uso en el front de prueba (AdminDashboard)

En `front-prueba/src/pages/AdminDashboard.jsx` se usan `api()`, `apiUpload()`, `getBaseUrl()` y `getToken()` de `api/api.js`.

| Acción | Código |
|--------|--------|
| Listar (catálogo) | `const data = await api('GET', '/libros'); setLibros(data?.data \|\| []);` |
| Cargar libro | `const fd = new FormData(); fd.append('pdf', pdfFile); fd.append('titulo', ...); fd.append('grado', ...); await apiUpload('/libros/cargar', fd);` |
| Descargar PDF | `fetch(getBaseUrl() + '/libros/' + id + '/pdf', { headers: { Authorization: 'Bearer ' + getToken() } })` → `res.blob()` y enlace de descarga |
| Otorgar a escuela | `await api('POST', '/escuelas/' + escuelaId + '/libros', { codigo });` |
| Libros de una escuela | `api('GET', '/escuelas/' + id + '/libros')` y `api('GET', '/escuelas/' + id + '/libros/pendientes')` |

---

## Contexto para el front (cargar libro)

Bloque para copiar/pegar al equipo de frontend:

- **Endpoint:** `POST /libros/cargar`
- **Rol:** Solo administrador. Header: `Authorization: Bearer <token>`.
- **Body:** `multipart/form-data`. No enviar header `Content-Type` (lo pone el navegador).
- **Campos obligatorios:** `pdf` (File, máx. 50 MB), `titulo` (string), `grado` (number).
- **Opcionales:** `descripcion`, `codigo`, `materiaId`.
- **Respuesta 201:** `message`, `description` (opcional) y `data` con `id`, `titulo`, `codigo`, `estado`, `numPaginas`, `unidades`, etc.
- **Errores:** 400 (PDF inválido o metadatos faltantes), 401, 403.
- **UX:** Mostrar “Procesando…” mientras la petición está en curso; al terminar el libro ya está listo.
