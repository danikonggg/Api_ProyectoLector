# API ApiLector — Guía Completa para Frontend

**Proyecto:** ApiLector (backend NestJS)
**Audiencia:** equipo Frontend
**Base URL:** `https://tu-api.onrender.com`

Cubre: **Evaluación**, **Gamificación** y **Estadísticas/Progreso** (alumno, maestro, director).

---

## Índice
- [0. Convenciones generales](#0-convenciones-generales)
- [PARTE A — Evaluación](#-parte-a--evaluación)
- [PARTE B — Gamificación](#-parte-b--gamificación)
- [PARTE C — Estadísticas y Progreso (Alumno / Maestro / Director)](#-parte-c--estadísticas-y-progreso)
- [Resumen de todos los endpoints](#resumen-de-todos-los-endpoints)
- [Errores comunes](#errores-comunes)

---

## 0. Convenciones generales

- **Auth:** todos requieren `Authorization: Bearer <accessToken>`. El guard valida el rol; si no coincide → `403`.
- **Formato de respuesta:** siempre `{ "message": string, "data": ... }` (algunos agregan campos extra al nivel raíz como `total`, `noVistas`).
- **IDs:** `libroId`, `segmentoId`, `alumnoId` van como enteros en la URL.
- **Opciones de respuesta** (evaluación): siempre una de `'A' | 'B' | 'C' | 'D'`.

> ⚠️ **Hay DOS rutas de evaluación**, no las mezcles:
> - **`/escuelas/mis-libros/...`** → **flujo oficial del alumno** (escolar). **Dispara la gamificación.** Úsalo.
> - **`/evaluacion/...`** → módulo alterno (diagnóstico, apoyos y estado salen de aquí), **no dispara gamificación** por sí solo.

### Flujo recomendado (alumno)
```
1. GET  /escuelas/mis-libros                              → libros + progreso
2. (primer acceso al libro) GET /evaluacion/diagnostico/:libroId
   └─ si necesitaDiagnostico → POST /evaluacion/diagnostico/:libroId
3. El alumno lee el segmento
4. GET  /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion   → preguntas
5. POST /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion   → enviar respuestas
   ├─ aprobado=true  → avanzar
   └─ aprobado=false → mostrar `apoyos` + reintento (POST .../reintento)
6. PATCH /escuelas/mis-libros/:libroId/progreso          → guardar avance (dispara puntos)
7. GET  /gamificacion/progreso | /insignias | /mapa      → refrescar UI de gamificación
```

---

# 📊 PARTE A — EVALUACIÓN

## A.1 Diagnóstico inicial (una vez por libro)

Ubica al alumno en un nivel (`basico` / `intermedio` / `avanzado`).

### `GET /evaluacion/diagnostico/:libroId`
```json
{
  "message": "Diagnostico obtenido correctamente.",
  "data": {
    "necesitaDiagnostico": true,
    "preguntas": [
      { "preguntaId": 12, "texto": "¿Cuál es la idea principal?", "opcionA": "...", "opcionB": "...", "opcionC": "...", "opcionD": "..." }
    ]
  }
}
```
> Si `necesitaDiagnostico` es `false`, no lo muestres (ya lo completó); `preguntas` viene vacío/ausente.

### `POST /evaluacion/diagnostico/:libroId`
**Body:**
```json
{ "respuestas": [ { "preguntaId": 12, "respuesta": "B" }, { "preguntaId": 13, "respuesta": "A" } ] }
```
**Respuesta:**
```json
{
  "message": "Diagnostico procesado correctamente.",
  "data": {
    "score": 75,
    "nivelAsignado": "intermedio",
    "tiempoMinimo": 40,
    "perfil": { "nivelActual": "intermedio", "diagnosticoCompletado": true, "...": "..." }
  }
}
```
**Reglas de nivel:** `score ≤ ~60` → `basico`, `61–79` → `intermedio`, `≥ 80` → `avanzado`.

---

## A.2 Evaluación por segmento (flujo oficial)

### `GET /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion`
```json
{
  "message": "Evaluacion del segmento obtenida correctamente.",
  "data": {
    "segmentoId": 123,
    "nivel": "intermedio",
    "preguntas": [
      { "preguntaId": 501, "texto": "...", "opcionA": "...", "opcionB": "...", "opcionC": "...", "opcionD": "...", "nivel": "intermedio", "tipo": "literal" }
    ],
    "umbralAprobacion": 70,
    "intentosRestantes": 3,
    "tiempoMinimoSegundos": 40
  }
}
```
- **`umbralAprobacion`**: % mínimo para aprobar (70).
- **`intentosRestantes`**: máximo **3 intentos** por segmento; si llega a 0 → `400`.
- **`tiempoMinimoSegundos`**: tiempo mínimo de lectura antes de evaluar (úsalo para la "pausa obligatoria" del front).

### `POST /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion`
**Body:**
```json
{
  "respuestas": [
    { "preguntaId": 501, "respuesta": "C", "tiempoMs": 8200 },
    { "preguntaId": 502, "respuesta": "A", "tiempoMs": 5400 }
  ],
  "nivel": "intermedio"
}
```
- `tiempoMs` (opcional): ms por pregunta. Mándalo si puedes.
- `nivel` (opcional): normalmente sobra (el backend usa el del perfil).

**Respuesta:**
```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 80,
    "aprobado": true,
    "puedeAvanzar": true,
    "siguienteAccion": "continuar",
    "apoyos": [],
    "tiposError": [],
    "gamificacion": {
      "puntosGanados": 25,
      "subioNivel": false,
      "nivelNuevo": null,
      "insigniasNuevas": [],
      "progresoActual": { "puntosTotales": 320, "nivelActual": 3, "rachaActual": 2, "porcentajeNivel": 45 }
    }
  }
}
```

**Cómo reaccionar:**
| Campo | Acción |
|---|---|
| `aprobado: true` / `siguienteAccion: "continuar"` | Desbloquear siguiente segmento |
| `aprobado: false` / `siguienteAccion: "refuerzo"` | Mostrar `apoyos` y botón de reintento |
| `gamificacion.puntosGanados > 0` | Animación de +puntos |
| `gamificacion.subioNivel: true` | Modal "¡Subiste al nivel N!" usando `nivelNuevo` |
| `gamificacion.insigniasNuevas` (claves) | Toast/confeti por insignia nueva |

### `POST /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion/reintento`
Genera una **variación** de preguntas (sin body). Mismo shape que el `GET` de evaluación. Úsalo cuando reprueba y quedan intentos.

---

## A.3 Apoyos pedagógicos (cuando reprueba)

Vienen embebidos en el POST cuando reprueba, o pídelos sueltos:

### `GET /evaluacion/:libroId/segmento/:segmentoId/apoyos`
```json
{
  "data": {
    "apoyos": [
      { "tipo": "pista", "contenido": "Relee el fragmento prestando atención a la idea principal." },
      { "tipo": "glosario", "contenido": "Palabras clave del fragmento:", "palabras": [ { "palabra": "metáfora", "definicion": "..." } ] }
    ]
  }
}
```
- **Fallo 1:** `tipo: "pista"`. **Fallo 2:** + `tipo: "glosario"` (array `palabras`). **Fallo 3:** apoyos adicionales (resumen).
- Renderiza según `tipo`.

---

## A.4 Estado de aprendizaje del alumno en un libro

### `GET /evaluacion/:libroId/estado`
```json
{
  "message": "Estado de aprendizaje obtenido correctamente.",
  "data": {
    "perfil": { "nivelActual": "intermedio", "tiempoMinimoActual": 40, "rachaPositiva": 2, "rachaNegativa": 0, "diagnosticoCompletado": true },
    "progreso": { "porcentaje": 45, "ultimaLectura": "2026-06-01T18:30:00Z" }
  }
}
```
El nivel y el tiempo mínimo se **adaptan solos**: si aprueba al primer intento seguido, sube; si falla, baja.

---

# 🎮 PARTE B — GAMIFICACIÓN

Base: `/gamificacion`. Requiere alumno autenticado.

### Cómo se ganan puntos (referencia)
| Evento | Puntos |
|---|---|
| Segmento leído | 10 |
| Evaluación aprobada | 25 |
| Evaluación perfecta (100%) | 50 |
| Libro completado | 100 |
| Bonus por racha diaria | 15 |
| Bonus al subir de nivel adaptativo | 30 |

> El front **no asigna puntos**: refleja lo que devuelve `gamificacion` en evaluaciones y en `PATCH .../progreso`, luego refresca con los GET de abajo.

## B.1 Progreso general

### `GET /gamificacion/progreso`
```json
{
  "message": "Progreso obtenido",
  "data": {
    "alumnoId": 42,
    "puntosTotales": 320,
    "nivelActual": 3,
    "librosCompletados": 1,
    "segmentosLeidos": 28,
    "evaluacionesOk": 18,
    "rachaActual": 2,
    "rachaMasLarga": 5,
    "ultimaActividad": "2026-06-03T20:00:00Z",
    "nivel":          { "nivel": 3, "nombre": "Lector Curioso", "puntosMin": 300, "puntosMax": 599, "icono": "...", "color": "#..." },
    "nivelSiguiente": { "nivel": 4, "nombre": "...", "puntosMin": 600, "puntosMax": 999, "icono": "...", "color": "#..." },
    "puntosParaSiguienteNivel": 280,
    "porcentajeNivel": 7
  }
}
```
- Barra de nivel → `porcentajeNivel`.
- "Te faltan X para nivel N" → `puntosParaSiguienteNivel` + `nivelSiguiente.nombre`.
- Badge → `nivel.icono` + `nivel.color`.

### `GET /gamificacion/niveles`
Catálogo completo de niveles (para el "mapa de niveles").

## B.2 Insignias / logros

### `GET /gamificacion/insignias`
```json
{
  "message": "Insignias obtenidas",
  "noVistas": 2,
  "total": 12,
  "obtenidas": 5,
  "data": [
    { "id": 1, "clave": "racha_7_dias", "nombre": "Constancia", "descripcion": "Lee 7 días seguidos", "icono": "fire", "categoria": "habitos", "obtenida": true, "obtenidaEn": "2026-06-01T10:00:00Z", "visto": false }
  ]
}
```
- Obtenidas a color, pendientes en gris (`obtenida: false`).
- `noVistas` → badge numérico. Las `obtenida:true` + `visto:false` → resáltalas.

### `PATCH /gamificacion/insignias/marcar-vistas`
Sin body. Llámalo al abrir la pantalla de insignias para apagar el badge.

## B.3 Mapa de lectura

### `GET /gamificacion/mapa`
Mapa de todos los libros: `{ "message": "...", "total": 3, "data": [ /* un mapa por libro */ ] }`

### `GET /gamificacion/mapa/:libroId`
```json
{
  "message": "Mapa del libro obtenido",
  "data": { "libroId": 7, "totalSegmentos": 20, "segmentosIds": [101,102,103], "completados": [101,102], "porcentaje": 10, "actualizadoEn": "2026-06-03T20:00:00Z" }
}
```
Pinta cada nodo; "completado" si su id está en `completados`.

## B.4 Guardar progreso de lectura (dispara puntos)

### `PATCH /escuelas/mis-libros/:libroId/progreso`
**Body** (ambos opcionales): `{ "porcentaje": 45, "ultimoSegmentoId": 123 }`
- Con `ultimoSegmentoId` → marca segmento leído (suma puntos).
- `porcentaje` a 100 → dispara libro completado (puntos + posibles insignias).
- La respuesta incluye `gamificacion` cuando hubo evento.

---

# 📈 PARTE C — ESTADÍSTICAS Y PROGRESO

## Mapa rápido: quién ve qué
| Rol | Qué ve | Endpoints |
|---|---|---|
| **Alumno** | Sus propias estadísticas | `GET /alumno/estadisticas` |
| **Maestro** | Grupos, alumnos del grupo, progreso por libro, detalle individual y evaluaciones | `/profesor/...` |
| **Director** | Dashboard de escuela (con agregados), alumnos, progreso por libro, evaluaciones | `/director/...` |
| **Admin** | Totales globales del panel | `GET /escuelas/stats` |

---

## C.1 ALUMNO — sus propias estadísticas

### `GET /alumno/estadisticas`
```json
{
  "data": {
    "librosLeidos": 2,
    "librosEnProgreso": 1,
    "tiempoTotalMinutos": 340,
    "tiempoEsteMesMinutos": 95,
    "promedioEvaluaciones": 82,
    "rachaActualDias": 3,
    "rachaMaximaDias": 7,
    "segmentosCompletados": 28,
    "anotacionesTotales": 12,
    "ultimaActividad": "2026-06-03T20:00:00Z"
  }
}
```
> Puntos/nivel/insignias/mapa → PARTE B (`/gamificacion/...`).

---

## C.2 MAESTRO — vista de grupo, individual y por libro

Base: `/profesor`. Rol **maestro**. Solo ve alumnos de **sus grupos** (si no → `403`).

### `GET /profesor/grupos`
```json
{ "data": [ { "id": "5", "nombre": "3°A", "grado": "3", "seccion": "A", "totalAlumnos": 28, "alumnosPendientesEvaluacion": 12 } ] }
```

### `GET /profesor/grupos/:grupoId/alumnos`
Progreso **por alumno** del grupo (si el grupo no es suyo → `403`).
```json
{
  "data": [
    { "alumnoId": "102", "nombre": "Ana López Pérez", "progresoPromedio": 64, "ultimaActividad": "2026-06-02T18:00:00Z", "estadoActividad": "active", "librosAsignados": 3, "librosCompletados": 1 }
  ]
}
```
- **`estadoActividad`** (semáforo): `active` (≤1 día), `warning` (≤4 días), `alert` (>4 días o nunca).

### `GET /profesor/libros/:libroId/alumnos`  🆕
Progreso de **un libro con todos los alumnos** de sus grupos. Ordenado por menor progreso primero (los que necesitan atención arriba).
```json
{
  "message": "Progreso del libro obtenido correctamente.",
  "data": {
    "libro": { "id": 7, "titulo": "El Principito", "autor": "..." },
    "totalSegmentos": 20,
    "totalAlumnos": 28,
    "data": [
      { "alumnoId": 102, "nombre": "Ana López Pérez", "progreso": 35, "ultimaLectura": "2026-06-02T18:00:00Z", "segmentosAprobados": 7, "totalSegmentos": 20, "scorePromedio": 78 }
    ]
  }
}
```

### `GET /profesor/alumnos/:alumnoId/libros`  🆕
Detalle **libro por libro** de un alumno de sus grupos.
```json
{
  "message": "Detalle de libros del alumno obtenido correctamente.",
  "total": 3,
  "data": [
    { "libroId": 7, "titulo": "El Principito", "autor": "...", "materia": { "id": 2, "nombre": "Español" }, "progreso": 64, "ultimoSegmentoId": 123, "ultimaLectura": "2026-06-02T18:00:00Z", "fechaAsignacion": "2026-04-01" }
  ]
}
```

### `GET /profesor/alumnos/:alumnoId/evaluaciones`  🆕
Detalle de evaluaciones (agrupado por libro).
```json
{
  "message": "Evaluaciones del alumno obtenidas correctamente.",
  "total": 12,
  "data": [
    {
      "libroId": 7,
      "titulo": "El Principito",
      "segmentosAprobados": 5,
      "totalIntentos": 12,
      "intentos": [
        { "segmentoId": 101, "nivelPregunta": "intermedio", "intento": 1, "score": 80, "aprobado": true, "tiposError": [], "tiempoRespuestaMs": 13600, "fecha": "2026-05-30T17:10:00Z" }
      ]
    }
  ]
}
```
Cada `intento` es un envío de evaluación de un segmento (hasta 3 por segmento).

---

## C.3 DIRECTOR — vista de escuela

Base: `/director`. La escuela se toma del **token** (no va en la URL). Rol **director**. Solo alumnos de **su escuela** (si no → `403`).

### `GET /director/dashboard`  (ahora con `agregados` 🆕)
```json
{
  "message": "Dashboard obtenido correctamente",
  "data": {
    "escuela": { "id": 1, "nombre": "Secundaria 5", "nivel": "secundaria", "clave": "...", "direccion": "...", "telefono": "..." },
    "totalEstudiantes": 320,
    "totalProfesores": 18,
    "librosDisponibles": 24,
    "agregados": {
      "progresoPromedio": 47,
      "tiempoTotalMinutos": 18450,
      "porcentajeAprobacion": 73,
      "evaluacionesRealizadas": 1240
    }
  }
}
```
- `progresoPromedio`: % promedio de avance de todos los libros de la escuela.
- `tiempoTotalMinutos`: minutos totales leídos (suma de sesiones).
- `porcentajeAprobacion`: % de evaluaciones aprobadas sobre el total.

### `GET /director/alumnos`
Todos los alumnos de su escuela (persona, grado, grupo, padre).
```json
{
  "message": "Alumnos de la escuela obtenidos correctamente.",
  "total": 320,
  "data": [
    { "id": "102", "grado": "3", "grupo": "A", "grupoId": "5", "cicloEscolar": "2025-2026", "persona": { "nombre": "Ana", "apellidoPaterno": "López", "apellidoMaterno": "Pérez", "correo": "...", "telefono": "..." }, "padre": { "parentesco": "madre", "persona": { "nombre": "...", "correo": "..." } } }
  ]
}
```

### `GET /director/maestros`
Maestros de su escuela (lista con datos de persona).

### `GET /director/libros/:libroId/alumnos`  🆕
Progreso de **un libro con todos los alumnos** de la escuela. Mismo shape que `/profesor/libros/:libroId/alumnos`.

### `GET /director/alumnos/:alumnoId/evaluaciones`  🆕
Detalle de evaluaciones de un alumno. Mismo shape que el del maestro.

### `GET /escuelas/alumnos/:alumnoId/libros`  (Admin/Director)
Detalle libro-por-libro de un alumno concreto (solo libros con licencia vigente).
```json
{
  "message": "Libros asignados obtenidos correctamente.",
  "total": 3,
  "data": [
    { "id": "7", "titulo": "El Principito", "autor": "...", "materia": { "id": 2, "nombre": "Español" }, "alumnoLibroId": 55, "progreso": 64, "ultimoSegmentoId": 123, "ultimaLectura": "2026-06-02T18:00:00Z", "fechaAsignacion": "2026-04-01T00:00:00Z" }
  ]
}
```

---

## C.4 ADMIN — panel de escuelas

### `GET /escuelas/stats`  *(solo admin)*
```json
{ "message": "...", "data": { "totalEscuelas": 5, "escuelasActivas": 4, "totalAlumnos": 1840, "totalProfesores": 134, "licencias": 2000 } }
```

---

## Resumen de todos los endpoints

### Evaluación
| Método | Ruta | Rol |
|---|---|---|
| GET | `/evaluacion/diagnostico/:libroId` | Alumno |
| POST | `/evaluacion/diagnostico/:libroId` | Alumno |
| GET | `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion` | Alumno |
| POST | `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion` | Alumno |
| POST | `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion/reintento` | Alumno |
| GET | `/evaluacion/:libroId/segmento/:segmentoId/apoyos` | Alumno |
| GET | `/evaluacion/:libroId/estado` | Alumno |

### Gamificación
| Método | Ruta | Rol |
|---|---|---|
| GET | `/gamificacion/progreso` | Alumno |
| GET | `/gamificacion/niveles` | Alumno |
| GET | `/gamificacion/insignias` | Alumno |
| PATCH | `/gamificacion/insignias/marcar-vistas` | Alumno |
| GET | `/gamificacion/mapa` | Alumno |
| GET | `/gamificacion/mapa/:libroId` | Alumno |
| PATCH | `/escuelas/mis-libros/:libroId/progreso` | Alumno |

### Estadísticas / Progreso
| Método | Ruta | Rol |
|---|---|---|
| GET | `/alumno/estadisticas` | Alumno |
| GET | `/profesor/grupos` | Maestro |
| GET | `/profesor/grupos/:grupoId/alumnos` | Maestro |
| GET | `/profesor/libros/:libroId/alumnos` 🆕 | Maestro |
| GET | `/profesor/alumnos/:alumnoId/libros` 🆕 | Maestro |
| GET | `/profesor/alumnos/:alumnoId/evaluaciones` 🆕 | Maestro |
| GET | `/director/dashboard` (con `agregados` 🆕) | Director |
| GET | `/director/alumnos` | Director |
| GET | `/director/maestros` | Director |
| GET | `/director/libros/:libroId/alumnos` 🆕 | Director |
| GET | `/director/alumnos/:alumnoId/evaluaciones` 🆕 | Director |
| GET | `/escuelas/alumnos/:alumnoId/libros` | Admin/Director |
| GET | `/escuelas/:id/alumnos` | Admin/Director |
| GET | `/escuelas/stats` | Admin |

---

## Errores comunes
| Código | Significado |
|---|---|
| `401` | Falta o expiró el `accessToken` |
| `403` | Rol incorrecto / recurso fuera de tu alcance (alumno de otro grupo o escuela) |
| `404` | Libro/segmento/alumno no encontrado o no asignado |
| `400` | Intentos de evaluación agotados, o segmento no pertenece al libro |
