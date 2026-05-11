# Documentacion de Cambio - Evaluacion por Segmento (MVP)

Este cambio agrega evaluacion de comprension por segmento para alumnos, sin romper el flujo actual de lectura/progreso.

## Objetivo

Agregar una capa de evaluacion entre "leer segmento" y "avanzar", con:

- obtencion de preguntas por segmento,
- envio de respuestas,
- decision de `puedeAvanzar`,
- reintento con variacion,
- persistencia de intentos en base de datos.

## Alcance Implementado

### Nuevo modelo persistente

Se creo tabla/entidad para guardar cada intento de evaluacion:

- Tabla: `Alumno_Segmento_Evaluacion`
- Entidad: `AlumnoSegmentoEvaluacion`

Campos guardados por intento:

- `alumno_id`
- `libro_id`
- `segmento_id`
- `nivel_pregunta` (`basico | intermedio | avanzado`)
- `intento`
- `preguntas` (jsonb)
- `respuestas` (jsonb)
- `score` (0-100)
- `aprobado` (boolean)
- `puede_avanzar` (boolean)
- `apoyos` (jsonb nullable)
- `creado_en`

## Reglas de negocio (MVP)

- Umbral de aprobacion: `70`
- Intentos maximos por segmento: `3`
- `puedeAvanzar = true` solo si `score >= 70`
- Reintento baja dificultad:
  - `avanzado -> intermedio`
  - `intermedio -> basico`
  - `basico -> basico`
- Si no hay preguntas en BD, backend intenta generarlas via `PreguntasSegmentoService`.

## Endpoints Nuevos (Alumno)

Base path: `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion`  
Guard: `AlumnoGuard` (requiere JWT de alumno)

### 1) Obtener evaluacion del segmento

**GET** `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion`

#### Query params (opcionales)

- `nivel`: `basico | intermedio | avanzado`

Si no se envia, el backend infiere nivel por progreso del alumno en ese libro.

#### Response 200 (ejemplo)

```json
{
  "message": "Evaluacion del segmento obtenida correctamente.",
  "data": {
    "segmentoId": 120,
    "nivel": "intermedio",
    "preguntas": [
      { "preguntaId": "120-intermedio-1", "texto": "Cual es la idea principal del fragmento?" },
      { "preguntaId": "120-intermedio-2", "texto": "Explica con tus palabras..." },
      { "preguntaId": "120-intermedio-3", "texto": "Que relacion observas entre...?" }
    ],
    "umbralAprobacion": 70,
    "intentosRestantes": 2
  }
}
```

#### Errores comunes

- `404`: libro no asignado / segmento no encontrado
- `400`: segmento no pertenece al libro

### 2) Responder evaluacion del segmento

**POST** `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion`

#### Body

```json
{
  "nivel": "intermedio",
  "respuestas": [
    { "preguntaId": "120-intermedio-1", "respuesta": "..." },
    { "preguntaId": "120-intermedio-2", "respuesta": "..." },
    { "preguntaId": "120-intermedio-3", "respuesta": "..." }
  ]
}
```

`nivel` es opcional.

#### Validaciones del body

- `respuestas` obligatorio
- `respuestas` debe tener al menos 1 elemento
- cada elemento requiere `preguntaId` y `respuesta` tipo string

#### Response 200 (ejemplo)

```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 67,
    "aprobado": false,
    "puedeAvanzar": false,
    "siguienteAccion": "refuerzo",
    "apoyos": [
      {
        "tipo": "pista",
        "contenido": "Relee el fragmento y responde con tus palabras: idea principal, un detalle clave y una relacion causa-efecto."
      }
    ]
  }
}
```

#### Errores comunes

- `400`: intentos agotados (`max = 3`)
- `400`: no hay preguntas disponibles para ese segmento/nivel
- `404`: libro no asignado / segmento no encontrado

### 3) Generar reintento de evaluacion

**POST** `/escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion/reintento`

#### Body

Sin body.

#### Response 200 (ejemplo)

```json
{
  "message": "Reintento de evaluacion generado correctamente.",
  "data": {
    "nivel": "basico",
    "preguntas": [
      { "preguntaId": "120-basico-1", "texto": "..." },
      { "preguntaId": "120-basico-2", "texto": "..." },
      { "preguntaId": "120-basico-3", "texto": "..." }
    ],
    "intento": 2
  }
}
```

#### Errores comunes

- `400`: intentos agotados
- `400`: no hay preguntas disponibles para reintento
- `404`: libro no asignado / segmento no encontrado

## Compatibilidad con lo existente

No se modifico el contrato actual de:

- `PATCH /escuelas/mis-libros/:libroId/progreso`

El flujo de lectura actual sigue funcionando; esta capa se integra como estado adicional antes de avanzar.

## Migracion requerida

Ejecutar esta migracion en BD:

- `migrations/add_alumno_segmento_evaluacion.sql`

Incluye:

- creacion de tabla `Alumno_Segmento_Evaluacion`
- indices por alumno/libro/segmento y por segmento

## Recomendacion para Front

Estados recomendados en UI:

- `sin_evaluacion`
- `pendiente`
- `aprobado`
- `refuerzo`
- `intentos_agotados`

Y mostrar dos conceptos separados:

- progreso de lectura (actual),
- progreso de comprension (nuevo, derivado de evaluaciones).
