# Fase 4 — Sistema de Evaluación Adaptativa
## Documentación para Frontend

> **Base URL:** `https://tu-api.render.com`
> **Auth:** Todos los endpoints requieren `Authorization: Bearer <access_token>` y el usuario debe ser de tipo **alumno**.
> **Fecha de referencia:** Mayo 2026

---

## Índice

1. [Resumen del sistema](#1-resumen-del-sistema)
2. [Flujo completo](#2-flujo-completo)
3. [Módulo: Diagnóstico inicial](#3-módulo-diagnóstico-inicial)
4. [Módulo: Evaluación de segmento](#4-módulo-evaluación-de-segmento)
5. [Módulo: Estado de aprendizaje](#5-módulo-estado-de-aprendizaje)
6. [Módulo: Apoyos pedagógicos](#6-módulo-apoyos-pedagógicos)
7. [Sistema adaptativo explicado](#7-sistema-adaptativo-explicado)
8. [Manejo de errores](#8-manejo-de-errores)
9. [Vistas recomendadas](#9-vistas-recomendadas)
10. [Cheat sheet — resumen de endpoints](#10-cheat-sheet--resumen-de-endpoints)

---

## 1. Resumen del sistema

El sistema de evaluación adaptativa tiene 3 grandes etapas:

```
ETAPA 1 → Diagnóstico inicial (una sola vez por libro)
            Determina el nivel de lectura del alumno: básico / intermedio / avanzado

ETAPA 2 → Ciclo de lectura + evaluación (por cada segmento del libro)
            El alumno lee el segmento → responde 3 preguntas de comprensión
            Tiene hasta 3 intentos para aprobar (umbral: 70%)

ETAPA 3 → Adaptación continua
            El sistema ajusta automáticamente nivel y tiempo mínimo de lectura
            según el desempeño acumulado del alumno
```

### Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| **Nivel** | `basico` / `intermedio` / `avanzado`. Determina la dificultad de las preguntas. |
| **Tiempo mínimo** | Segundos que el alumno debe haber pasado leyendo antes de poder evaluar. Devuelto como `tiempoMinimoSegundos`. |
| **Umbral de aprobación** | 70% — siempre fijo. 2 de 3 preguntas correctas = aprobado. |
| **Intentos** | Máximo 3 por segmento. Cada reintento trae preguntas diferentes (rotación). |
| **Apoyos pedagógicos** | Pistas, glosario y resumen que se desbloquean progresivamente al fallar. |
| **Racha positiva** | 3 evaluaciones aprobadas en 1er intento → sube de nivel. |
| **Racha negativa** | 2 evaluaciones falladas (más de 1 intento) → baja de nivel. |

---

## 2. Flujo completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    INICIO: Alumno abre un libro                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
             GET /evaluacion/diagnostico/:libroId
                               │
          ┌────────────────────┴──────────────────┐
          │ necesitaDiagnostico: true              │ necesitaDiagnostico: false
          ▼                                        ▼
   Mostrar diagnóstico                    Ir directo al libro
   (10 preguntas generales)
          │
          ▼
   POST /evaluacion/diagnostico/:libroId
   (envía respuestas del alumno)
          │
          ▼
   Recibe: nivel asignado + tiempo mínimo
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CICLO POR SEGMENTO DEL LIBRO                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
   Alumno lee el segmento
   (respetar tiempoMinimoSegundos antes de habilitar el botón "Evaluar")
          │
          ▼
   GET /evaluacion/:libroId/segmento/:segmentoId
   (obtiene las 3 preguntas del intento actual)
          │
          ▼
   Alumno responde las 3 preguntas
   (guardar tiempoMs por pregunta si es posible)
          │
          ▼
   POST /evaluacion/:libroId/segmento/:segmentoId
          │
     ┌────┴────┐
     │         │
  aprobado   reprobado
     │         │
     ▼         ▼
  Avanzar    ¿intentos disponibles?
  siguiente  ┌────────────────────┐
  segmento   │ Sí (< 3 intentos)  │ No (3 intentos agotados)
             ▼                    ▼
          Mostrar apoyos       Mostrar apoyos
          pedagógicos          y marcar segmento
          + botón reintentar   como "no superado"
                               (el alumno puede avanzar
                               igualmente, pero sin
                               sumar racha positiva)
```

---

## 3. Módulo: Diagnóstico inicial

### 3.1 Verificar si necesita diagnóstico

```
GET /evaluacion/diagnostico/:libroId
Authorization: Bearer <access_token>
```

**Caso A — Alumno ya hizo el diagnóstico antes:**
```json
{
  "message": "Diagnostico obtenido correctamente.",
  "data": {
    "necesitaDiagnostico": false
  }
}
```
→ **Acción front:** No mostrar diagnóstico, ir directo a la lectura.

**Caso B — Alumno nunca ha hecho el diagnóstico:**
```json
{
  "message": "Diagnostico obtenido correctamente.",
  "data": {
    "necesitaDiagnostico": true,
    "preguntas": [
      {
        "preguntaId": 1,
        "texto": "Lee el siguiente fragmento: 'El agua es un recurso esencial para la vida...' ¿Cuál es la idea principal de este texto?",
        "opcionA": "El agua es un líquido",
        "opcionB": "El agua es fundamental para la vida de todos los seres vivos",
        "opcionC": "Los seres vivos necesitan comer",
        "opcionD": "El agua se encuentra en los ríos"
      }
      // ... 9 preguntas más (total 10)
    ]
  }
}
```
→ **Acción front:** Mostrar pantalla de diagnóstico con las 10 preguntas.

> ⚠️ **Importante:** Las preguntas de diagnóstico NO incluyen `respuestaCorrecta`. Nunca la recibirás del backend.

---

### 3.2 Enviar respuestas del diagnóstico

```
POST /evaluacion/diagnostico/:libroId
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "respuestas": [
    { "preguntaId": 1, "respuesta": "B" },
    { "preguntaId": 2, "respuesta": "C" },
    { "preguntaId": 3, "respuesta": "C" },
    { "preguntaId": 4, "respuesta": "C" },
    { "preguntaId": 5, "respuesta": "D" },
    { "preguntaId": 6, "respuesta": "B" },
    { "preguntaId": 7, "respuesta": "D" },
    { "preguntaId": 8, "respuesta": "C" },
    { "preguntaId": 9, "respuesta": "C" },
    { "preguntaId": 10, "respuesta": "D" }
  ]
}
```

**Reglas del body:**
- `respuestas` — array, requerido
- `preguntaId` — número entero, requerido
- `respuesta` — string, solo `"A"`, `"B"`, `"C"` o `"D"`, requerido
- Debes enviar **todas las preguntas** que recibiste

**Response:**
```json
{
  "message": "Diagnostico procesado correctamente.",
  "data": {
    "score": 80,
    "nivelAsignado": "avanzado",
    "tiempoMinimo": 180,
    "perfil": { /* objeto interno, puedes ignorarlo */ }
  }
}
```

**Tabla de niveles según score:**

| Score del diagnóstico | Nivel asignado | Tiempo mínimo de lectura |
|-----------------------|---------------|--------------------------|
| 0% – 50%              | `basico`      | 360 segundos (6 min)     |
| 51% – 79%             | `intermedio`  | 270 segundos (4.5 min)   |
| 80% – 100%            | `avanzado`    | 180 segundos (3 min)     |

→ **Acción front:** Mostrar pantalla con el nivel asignado y redirigir al libro.

---

## 4. Módulo: Evaluación de segmento

### 4.1 Obtener preguntas del segmento

Llama a este endpoint cuando el alumno **va a evaluar** un segmento específico.

```
GET /evaluacion/:libroId/segmento/:segmentoId
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Evaluacion del segmento obtenida correctamente.",
  "data": {
    "segmentoId": 12,
    "nivel": "intermedio",
    "preguntas": [
      {
        "preguntaId": 47,
        "texto": "¿Cuál es la idea principal del fragmento?",
        "opcionA": "La migración de aves es un fenómeno estacional",
        "opcionB": "Las aves no pueden sobrevivir en climas fríos",
        "opcionC": "Todos los animales migran en invierno",
        "opcionD": "La temperatura afecta solo a los mamíferos"
      },
      {
        "preguntaId": 48,
        "texto": "Según el texto, ¿qué desencadena la migración?",
        "opcionA": "La falta de alimento en verano",
        "opcionB": "Los cambios en la temperatura y el fotoperíodo",
        "opcionC": "Las tormentas eléctricas",
        "opcionD": "El instinto de reproducción únicamente"
      },
      {
        "preguntaId": 49,
        "texto": "¿Qué significa 'fotoperíodo' según el contexto del fragmento?",
        "opcionA": "La intensidad de la luz solar",
        "opcionB": "La duración del día y la noche",
        "opcionC": "La cantidad de horas de sueño",
        "opcionD": "El ciclo lunar mensual"
      }
    ],
    "umbralAprobacion": 70,
    "intentosRestantes": 3,
    "tiempoMinimoSegundos": 270
  }
}
```

**Campos importantes:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nivel` | string | Nivel del alumno en este momento |
| `preguntas` | array | Siempre **3 preguntas**. Las opciones pueden estar en diferente orden en cada intento. |
| `umbralAprobacion` | number | Siempre `70`. Necesitas 2/3 correctas para aprobar. |
| `intentosRestantes` | number | Cuántos intentos le quedan **incluyendo el actual**. |
| `tiempoMinimoSegundos` | number | Segundos que debe haber pasado el alumno leyendo antes de evaluar. |

> ⚠️ **Importante:** Las preguntas NO incluyen `respuestaCorrecta`. En cada reintento (intento 2 o 3), las preguntas pueden rotar (distintas preguntas del banco) y las opciones pueden estar en diferente orden.

**Lógica de habilitación del botón "Evaluar":**
```javascript
// Solo habilitar cuando el alumno ha leído suficiente tiempo
const puedeEvaluar = tiempoLeyendoSegundo >= data.tiempoMinimoSegundos;
```

---

### 4.2 Enviar respuestas de la evaluación

```
POST /evaluacion/:libroId/segmento/:segmentoId
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "respuestas": [
    { "preguntaId": 47, "respuesta": "A", "tiempoMs": 12400 },
    { "preguntaId": 48, "respuesta": "B", "tiempoMs": 8700 },
    { "preguntaId": 49, "respuesta": "B", "tiempoMs": 15200 }
  ]
}
```

**Campos del body:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `preguntaId` | number | ✅ | ID de la pregunta (el mismo que devolvió el GET) |
| `respuesta` | string | ✅ | Solo `"A"`, `"B"`, `"C"` o `"D"` |
| `tiempoMs` | number | ❌ | Milisegundos que tardó en responder esa pregunta. Opcional, pero se recomienda enviarlo para telemetría. |

**Response — Caso APROBADO (score ≥ 70):**
```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 100,
    "aprobado": true,
    "puedeAvanzar": true,
    "siguienteAccion": "continuar",
    "apoyos": [],
    "tiposError": {}
  }
}
```

**Response — Caso REPROBADO con intentos restantes:**
```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 33,
    "aprobado": false,
    "puedeAvanzar": false,
    "siguienteAccion": "refuerzo",
    "apoyos": [
      {
        "tipo": "pista",
        "contenido": "Presta atención a cómo el autor describe el comportamiento de las aves en el segundo párrafo."
      }
    ],
    "tiposError": {
      "comprension_literal": 1,
      "inferencia": 1
    }
  }
}
```

**Response — Caso REPROBADO en 2do intento (más apoyos):**
```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 33,
    "aprobado": false,
    "puedeAvanzar": false,
    "siguienteAccion": "refuerzo",
    "apoyos": [
      {
        "tipo": "pista",
        "contenido": "Presta atención a cómo el autor describe el comportamiento..."
      },
      {
        "tipo": "glosario",
        "contenido": "Palabras clave del fragmento que pueden ayudarte a comprender mejor:",
        "palabras": [
          { "palabra": "migración", "definicion": "Desplazamiento periódico de animales de un lugar a otro" },
          { "palabra": "fotoperíodo", "definicion": "Duración relativa del día y la noche" }
        ]
      }
    ],
    "tiposError": {
      "comprension_literal": 2
    }
  }
}
```

**Response — Caso REPROBADO en 3er intento (intentos agotados):**
```json
{
  "message": "Evaluacion registrada correctamente.",
  "data": {
    "score": 0,
    "aprobado": false,
    "puedeAvanzar": false,
    "siguienteAccion": "refuerzo",
    "apoyos": [
      { "tipo": "pista", "contenido": "..." },
      { "tipo": "glosario", "contenido": "...", "palabras": [...] },
      { "tipo": "resumen", "contenido": "Este fragmento trata sobre la migración estacional de las aves, un fenómeno impulsado por cambios en temperatura y disponibilidad de alimento..." }
    ],
    "tiposError": { ... }
  }
}
```

**Error — Intentos agotados (si intentas enviar un 4to intento):**
```json
HTTP 400
{
  "statusCode": 400,
  "message": "Ya agotaste los intentos de evaluacion para este segmento."
}
```

---

### Lógica de apoyos pedagógicos

Los apoyos se entregan progresivamente según cuántos intentos fallidos lleva:

| Intento fallido | Apoyos que se desbloquean |
|-----------------|--------------------------|
| 1er fallo       | 🔍 Pista contextual |
| 2do fallo       | 🔍 Pista contextual + 📖 Glosario de palabras clave |
| 3er fallo       | 🔍 Pista + 📖 Glosario + 📄 Resumen del fragmento |

**Tipos de apoyo (`apoyo.tipo`):**

| tipo | Descripción | ¿Tiene `palabras`? |
|------|-------------|-------------------|
| `"pista"` | Pista contextual para guiar la relectura | No |
| `"glosario"` | Lista de palabras clave con definiciones | Sí |
| `"resumen"` | Resumen completo del fragmento | No |

---

### Tipos de error (`tiposError`)

El backend clasifica las preguntas respondidas incorrectamente por tipo. Úsalo si quieres mostrar retroalimentación detallada.

```json
{
  "comprension_literal": 1,   // Preguntas de comprensión directa del texto
  "inferencia": 1,             // Preguntas de inferencia o deducción
  "vocabulario": 0,            // Preguntas sobre significado de palabras
  "idea_principal": 1          // Preguntas sobre la idea principal
}
```

---

## 5. Módulo: Estado de aprendizaje

Consulta el perfil adaptativo y el progreso del alumno en un libro.

```
GET /evaluacion/:libroId/estado
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Estado de aprendizaje obtenido correctamente.",
  "data": {
    "perfil": {
      "nivelActual": "intermedio",
      "tiempoMinimoActual": 270,
      "rachaPosiva": 2,
      "rachaNegativa": 0,
      "diagnosticoCompletado": true
    },
    "progreso": {
      "porcentaje": 45,
      "ultimaLectura": "2026-05-18T14:32:00.000Z"
    }
  }
}
```

**Campos del perfil:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nivelActual` | string | `"basico"` / `"intermedio"` / `"avanzado"` |
| `tiempoMinimoActual` | number | Segundos mínimos de lectura requeridos actualmente |
| `rachaPosiva` | number | Evaluaciones aprobadas en 1er intento consecutivas (máx 3 para subir nivel) |
| `rachaNegativa` | number | Evaluaciones que requirieron más de 1 intento consecutivas (máx 2 para bajar nivel) |
| `diagnosticoCompletado` | boolean | Si ya realizó el diagnóstico inicial |

> 💡 **Tip:** Usa este endpoint al inicio de una sesión o al entrar al libro para saber si el alumno necesita diagnóstico antes de mostrar el contenido.

---

## 6. Módulo: Apoyos pedagógicos (consulta independiente)

Si necesitas mostrar los apoyos pedagógicos sin pasar por la evaluación (ej. botón "Ver ayuda" separado):

```
GET /evaluacion/:libroId/segmento/:segmentoId/apoyos
Authorization: Bearer <access_token>
```

**Response:** Mismo formato de apoyos que devuelve el POST de evaluación.

```json
{
  "message": "Apoyos pedagogicos obtenidos correctamente.",
  "data": {
    "apoyos": [
      {
        "tipo": "pista",
        "contenido": "Presta atención al tercer párrafo..."
      }
    ]
  }
}
```

> **Nota:** Si el alumno no ha fallado ningún intento aún, puede devolver una pista de todas formas (el sistema siempre incluye al menos la pista básica).

---

## 7. Sistema adaptativo explicado

### Cómo sube o baja el nivel

El sistema ajusta el nivel automáticamente **después de cada evaluación** enviada con el POST. El front no necesita hacer nada explícito — solo consultar el estado con GET `/estado` para reflejar cambios.

```
SUBIR DE NIVEL:
  - 3 evaluaciones aprobadas consecutivas en el PRIMER intento
  - Efecto: nivel sube un escalón + tiempo mínimo de lectura baja -20 segundos
  - Límite: no puede subir más de "avanzado"

BAJAR DE NIVEL:
  - 2 evaluaciones consecutivas que requirieron MÁS DE 1 intento para aprobar (o se reprobaron)
  - Efecto: nivel baja un escalón + tiempo mínimo de lectura sube +30 segundos
  - Límite: no puede bajar más de "basico"
```

### Tiempos mínimos de lectura

| Nivel | Tiempo base | Mínimo posible | Máximo posible |
|-------|------------|----------------|----------------|
| `basico` | 360 s (6 min) | 60 s | 600 s |
| `intermedio` | 270 s (4.5 min) | 60 s | 600 s |
| `avanzado` | 180 s (3 min) | 60 s | 600 s |

---

## 8. Manejo de errores

### Errores HTTP comunes

| Código | Cuándo ocurre | Mensaje típico |
|--------|--------------|----------------|
| `400` | Intentos agotados | `"Ya agotaste los intentos de evaluacion para este segmento."` |
| `400` | El segmento no pertenece al libro | `"El segmento no pertenece al libro indicado."` |
| `401` | Token expirado o inválido | `"Unauthorized"` |
| `403` | Usuario no es alumno | `"Forbidden resource"` |
| `404` | Libro no asignado al alumno | `"No tienes asignado este libro."` |
| `404` | Segmento no existe | `"Segmento no encontrado."` |
| `422` | Body inválido (campo faltante, respuesta no A/B/C/D) | Errores de validación |

### Manejo de validación del body (422)

```json
HTTP 422
{
  "message": [
    "respuestas.0.respuesta must be one of the following values: A, B, C, D",
    "respuestas.1.preguntaId must be an integer number"
  ],
  "error": "Unprocessable Entity",
  "statusCode": 422
}
```

---

## 9. Vistas recomendadas

### Vista 1: Pantalla de Diagnóstico
**Cuándo mostrar:** Al abrir un libro por primera vez (`necesitaDiagnostico: true`)

```
┌──────────────────────────────────────────────┐
│  📚 Diagnóstico inicial                       │
│  Antes de comenzar, evaluemos tu nivel de    │
│  comprensión lectora.                         │
│                                              │
│  Pregunta 1 de 10                            │
│  ────────────────────────────────────────    │
│  Lee el siguiente fragmento:                  │
│  "El agua es un recurso esencial..."          │
│                                              │
│  ¿Cuál es la idea principal?                 │
│                                              │
│  ○ A. El agua es un líquido                  │
│  ○ B. El agua es fundamental para la vida    │
│  ○ C. Los seres vivos necesitan comer        │
│  ○ D. El agua se encuentra en los ríos       │
│                                              │
│              [Siguiente →]                   │
└──────────────────────────────────────────────┘
```

**Flujo:**
1. GET `/evaluacion/diagnostico/:libroId` → obtener preguntas
2. Mostrar las 10 preguntas una por una (o todas juntas)
3. Al terminar → POST `/evaluacion/diagnostico/:libroId`
4. Mostrar resultado con nivel asignado y redirigir

---

### Vista 2: Pantalla de lectura del segmento

```
┌──────────────────────────────────────────────┐
│  📖 Capítulo 3 - Segmento 2                  │
│  Nivel: Intermedio | Tiempo restante: 3:42   │
│                                              │
│  [Contenido del segmento de lectura...]      │
│  Lorem ipsum dolor sit amet...              │
│                                              │
│                                              │
│  ⏱️ Progreso de lectura:                     │
│  [████████░░░░░░░░░░░░] 42%                  │
│                                              │
│         [Evaluar este segmento] (bloqueado)  │
└──────────────────────────────────────────────┘
```

**Lógica:**
```javascript
// Iniciar temporizador al mostrar el segmento
let segundosLeyendo = 0;
const timer = setInterval(() => {
  segundosLeyendo++;
  actualizarProgresoBarra(segundosLeyendo, tiempoMinimoSegundos);

  if (segundosLeyendo >= tiempoMinimoSegundos) {
    habilitarBotonEvaluar();
    clearInterval(timer);
  }
}, 1000);
```

---

### Vista 3: Evaluación del segmento

```
┌──────────────────────────────────────────────┐
│  ✏️ Evaluación - Segmento 2                   │
│  Intento 1 de 3 | Umbral: 70%               │
│                                              │
│  Pregunta 1:                                 │
│  ¿Cuál es la idea principal del fragmento?   │
│                                              │
│  ○ A. La migración es estacional            │
│  ○ B. Las aves no sobreviven en frío         │
│  ○ C. Todos los animales migran             │
│  ○ D. La temperatura afecta mamíferos       │
│                                              │
│  ── Pregunta 2 ──────────────────────────    │
│  ...                                         │
│                                              │
│              [Enviar respuestas]             │
└──────────────────────────────────────────────┘
```

**Importante:** Registrar `tiempoMs` por pregunta para enviarlo en el POST.

---

### Vista 4: Resultado de la evaluación

**Caso aprobado:**
```
┌──────────────────────────────────────────────┐
│  🎉 ¡Aprobaste!                              │
│                                              │
│  Tu puntuación: 100%                         │
│  2/3 respuestas correctas                    │
│                                              │
│  ✨ ¡Vas muy bien! Llevas 2 evaluaciones     │
│     aprobadas en primer intento.             │
│                                              │
│         [Continuar al siguiente segmento →]  │
└──────────────────────────────────────────────┘
```

**Caso reprobado con intentos restantes:**
```
┌──────────────────────────────────────────────┐
│  😔 Casi lo logras                           │
│                                              │
│  Tu puntuación: 33%                          │
│  1/3 respuestas correctas (necesitas 70%)    │
│                                              │
│  💡 Pista:                                   │
│  Presta atención al segundo párrafo donde    │
│  el autor describe el comportamiento...      │
│                                              │
│  Te quedan 2 intentos más                   │
│                                              │
│  [Volver a leer]    [Intentar de nuevo →]   │
└──────────────────────────────────────────────┘
```

**Caso intentos agotados:**
```
┌──────────────────────────────────────────────┐
│  📚 Intentos agotados                        │
│                                              │
│  No pudiste superar este segmento,           │
│  pero puedes continuar leyendo.              │
│                                              │
│  📄 Resumen del fragmento:                   │
│  Este fragmento trata sobre la migración     │
│  estacional de las aves...                   │
│                                              │
│  📖 Palabras clave:                          │
│  • migración: desplazamiento periódico...    │
│  • fotoperíodo: duración del día y noche...  │
│                                              │
│         [Continuar al siguiente segmento →]  │
└──────────────────────────────────────────────┘
```

---

### Vista 5: Progreso del alumno (perfil adaptativo)

```
┌──────────────────────────────────────────────┐
│  📊 Tu progreso en este libro                │
│                                              │
│  Nivel actual: ⭐ Intermedio                 │
│  Tiempo mínimo de lectura: 4 min 30 seg     │
│                                              │
│  Racha positiva: ██░░░ 2/3 (¡casi sube!)   │
│                                              │
│  Progreso del libro: 45%                    │
│  [████████████████░░░░░░░░░░░░░░░░░░]       │
│  Última lectura: hace 2 días               │
└──────────────────────────────────────────────┘
```

---

## 10. Cheat sheet — resumen de endpoints

| # | Método | Endpoint | ¿Cuándo usar? |
|---|--------|----------|---------------|
| 1 | `GET` | `/evaluacion/diagnostico/:libroId` | Al abrir un libro — verificar si necesita diagnóstico |
| 2 | `POST` | `/evaluacion/diagnostico/:libroId` | Enviar respuestas del diagnóstico inicial |
| 3 | `GET` | `/evaluacion/:libroId/segmento/:segmentoId` | Obtener preguntas justo antes de evaluar el segmento |
| 4 | `POST` | `/evaluacion/:libroId/segmento/:segmentoId` | Enviar respuestas de la evaluación |
| 5 | `GET` | `/evaluacion/:libroId/estado` | Consultar nivel, racha y progreso del alumno |
| 6 | `GET` | `/evaluacion/:libroId/segmento/:segmentoId/apoyos` | Consultar apoyos pedagógicos sin evaluar |

### Flujo mínimo para implementar

```javascript
// 1. Al entrar a un libro
const { necesitaDiagnostico, preguntas } = await GET(`/evaluacion/diagnostico/${libroId}`)

// 2. Si necesita diagnóstico
if (necesitaDiagnostico) {
  mostrarDiagnostico(preguntas)
  const resultado = await POST(`/evaluacion/diagnostico/${libroId}`, { respuestas })
  mostrarNivelAsignado(resultado.nivelAsignado)
}

// 3. Para cada segmento del libro
iniciarTemporizador()  // medir tiempo de lectura

// 4. Cuando el alumno quiere evaluar
const { preguntas, tiempoMinimoSegundos, intentosRestantes } = await GET(`/evaluacion/${libroId}/segmento/${segmentoId}`)
esperarTiempoMinimo(tiempoMinimoSegundos)
mostrarPreguntas(preguntas)

// 5. Al enviar respuestas
const resultado = await POST(`/evaluacion/${libroId}/segmento/${segmentoId}`, {
  respuestas: [
    { preguntaId: 47, respuesta: "A", tiempoMs: 12400 },
    // ...
  ]
})

// 6. Según el resultado
if (resultado.aprobado) {
  avanzarSiguienteSegmento()
} else if (intentosRestantes > 1) {
  mostrarApoyos(resultado.apoyos)
  ofrecerReintento()
} else {
  mostrarApoyosFinales(resultado.apoyos)
  permitirAvanzar()  // aunque no aprobó, puede continuar
}
```

---

> **Nota de migración para producción:**
> Si la API está en Render y aún no corres la migración de Fase 4, debes ejecutar el archivo `migrations/add_fase4_evaluacion_adaptativa.sql` en el SQL Editor de Supabase antes de usar estos endpoints.

---

*Documentación generada para Proyecto Lector — Fase 4 | Mayo 2026*
