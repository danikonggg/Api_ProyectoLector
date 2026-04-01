# Revisión Técnica: Sistema de Procesamiento de Libros PDF

**Documento de Technical Design Review** — Arquitectura de software para plataformas educativas y procesamiento de documentos.

---

## 1. Evaluación del Diseño Actual

### 1.1 Arquitectura actual (visión general)

```
[Request] → [Controller] → [LibrosService] → [LibrosPdfService] → [Segmentos]
                     ↓              ↓                    ↓
              [PdfStorage]   [pdf-text-cleaner]    [PreguntasSegmento]
                     ↓                                      ↓
              [Disco: pdfs/]                        [Groq API]
```

**Fortalezas identificadas:**

- Separación razonable: Controller, Service, LibrosPdfService, PdfStorageService, PreguntasSegmentoService
- Doble motor de extracción: pdfjs-dist + fallback a pdf-parse
- Limpieza exhaustiva de texto (ligaduras, Unicode, headers/footers)
- Segmentación que respeta párrafos y oraciones (~200–500 palabras)
- Auditoría en operaciones críticas
- Generación de preguntas con niveles (básico, intermedio, avanzado) y concurrencia limitada
- Manejo de rate limit 429 con reintentos y backoff exponencial en PreguntasSegmentoService

**Debilidades críticas:**

| Área | Problema |
|------|----------|
| **Procesamiento síncrono** | Todo el flujo (extracción, segmentación, guardar PDF, generar preguntas) ocurre en el mismo request HTTP → timeout en libros grandes |
| **Ausencia de colas** | Sin BullMQ/RabbitMQ: no hay desacoplamiento, ni reintentos, ni escalado horizontal |
| **PDFs escaneados** | Rechazados explícitamente; no hay OCR → pérdida de contenido educativo valioso |
| **Validación superficial** | Solo magic bytes y mimetype; no validación de estructura interna del PDF |
| **Seguridad** | Sin rate limiting específico para uploads; sin antivirus/quarantine; almacenamiento local en disco |
| **Unidad única** | Siempre se crea "Unidad 1"; no se detectan capítulos reales del libro |
| **Sin idempotencia** | Reintentos manuales pueden duplicar libros si falla tras guardar |
| **Generación de preguntas en banda** | Si falla Groq, el libro queda "listo" pero sin preguntas; no hay job diferido para reintentar |

---

## 2. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación sugerida |
|--------|--------------|---------|---------------------|
| Timeout HTTP (libros >100 páginas) | Alta | Alto | Procesamiento asíncrono con colas |
| OOM por PDFs muy grandes (50 MB en RAM) | Media | Alto | Streaming + chunks; límites por worker |
| PDFs maliciosos (polyglots, exploits) | Media | Crítico | Sandbox, antivirus, validación profunda |
| Groq rate limit en libros con muchos segmentos | Alta | Medio | Cola separada para preguntas; prioridad y backoff |
| Pérdida de datos si falla tras guardar segmentos | Baja | Alto | Transacciones; compensación; estado intermedio |
| Escalabilidad a miles de libros | Alta | Alto | Arquitectura basada en colas y workers distribuidos |

---

## 3. Propuesta de Arquitectura Mejorada

### 3.1 Flujo rediseñado (alta nivel)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTA (Request HTTP)                             │
│  POST /libros/cargar → Validación rápida → Guardar buffer temporal           │
│                    → Crear Libro (estado: pendiente)                         │
│                    → Encolar job "procesar-libro"                            │
│                    → Responder 202 Accepted { jobId, libroId }                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COLA: procesar-libro (BullMQ)                           │
│  Worker 1..N:                                                                │
│    1. Leer buffer desde storage temporal (S3 / disco)                        │
│    2. Extraer texto (pdfjs / pdf-parse / OCR si aplica)                      │
│    3. Limpiar y segmentar                                                    │
│    4. Persistir unidades + segmentos                                         │
│    5. Guardar PDF definitivo                                                 │
│    6. Estado → listo                                                         │
│    7. Encolar job "generar-preguntas" (cola separada)                        │
│    Reintentos: 3 | Backoff: exponencial | Timeout: 10 min                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COLA: generar-preguntas (BullMQ)                          │
│  Worker 1..M:                                                                │
│    Por cada segmento: llamada Groq (1 por segmento, 3 niveles)               │
│    Reintentos: 5 (por rate limit) | Backoff: exponencial                     │
│    Prioridad: libros con menos segmentos primero (opcional)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Diagrama de componentes

```
                    ┌──────────────────┐
                    │  API (NestJS)    │
                    │  POST /cargar    │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Validación     │  │ Storage Temp   │  │ LibroRepository│
│ (magic bytes,  │  │ (S3/Redis/     │  │ create(pend.)  │
│  size, virus)  │  │  filesystem)   │  └────────────────┘
└────────────────┘  └────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
         ┌────────────────────┐
         │ BullMQ / Redis     │
         │ Queue: libros      │
         └────────┬───────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐
│Worker 1│  │Worker 2│  │Worker N│  ← Procesamiento paralelo
└────────┘  └────────┘  └────────┘
```

---

## 4. Mejoras Propuestas (Detalle)

### 4.1 Rediseño del flujo de procesamiento

| Fase | Actual | Propuesto |
|------|--------|-----------|
| Recepción | Síncrona, todo en memoria | Validación rápida + guardar en storage temporal + encolar |
| Respuesta | 201 con libro procesado | 202 Accepted con `{ libroId, jobId }` + `GET /libros/:id/estado` |
| Extracción | En request HTTP | En worker BullMQ |
| Segmentación | Igual | Igual (ya es correcta) |
| Preguntas | Inmediato en mismo proceso | Cola separada, worker dedicado |
| Estado del libro | `procesando` → `listo` o `error` | `pendiente` → `extrayendo` → `segmentando` → `generando_preguntas` → `listo` / `error` |

### 4.2 Validación de archivos reforzada

```typescript
// Validaciones a implementar (además de magic bytes y size):

// 1. Verificar estructura PDF interna (parsing mínimo)
// - Usar pdf-lib o similar para abrir y comprobar que tiene páginas válidas

// 2. Detección de polyglots / tipos MIME incorrectos
const fileType = await import('file-type');
const detected = await fileType.fromBuffer(buffer);
if (detected?.mime !== 'application/pdf') { throw ... }

// 3. Sanitización de metadatos del PDF (evitar XXE, inyecciones)
// - Quitar XMP, JavaScript embebido si existen

// 4. Límite de páginas (evitar DoS)
if (numPaginas > 500) throw new BadRequestException('Máximo 500 páginas por libro.');

// 5. (Opcional) ClamAV o servicio externo para malware
```

**Librerías sugeridas:**

- `file-type` — Detección real del tipo por contenido
- `pdf-lib` — Validación estructural ligera
- `clamscan` (Node) o ClamAV — Antivirus si se requiere máximo nivel de seguridad

### 4.3 Seguridad del endpoint

| Medida | Implementación sugerida |
|--------|-------------------------|
| Rate limit por usuario | `@nestjs/throttler` ya existe; añadir límite específico para `/libros/cargar` (ej. 5 req/10 min por admin) |
| Límite de tamaño | Ya existe 50 MB; considerar reducir a 30 MB para evitar OOM |
| Validación de nombre de archivo | Sanitizar `originalname`; rechazar paths con `..` o caracteres especiales |
| Quarantine | Guardar PDFs en carpeta temporal antes de procesar; mover a definitiva solo tras éxito |
| Audit | Ya hay `AuditService`; asegurar que se registre tamaño, hash, IP, usuario |
| CORS y headers | Helmet ya en uso; revisar `Content-Security-Policy` para uploads |

### 4.4 Colas de procesamiento (BullMQ + Redis)

**Por qué BullMQ:**

- Nativo para NestJS (`@nestjs/bull`)
- Persistencia en Redis
- Reintentos configurables
- Prioridades
- Eventos (completed, failed)
- Dashboard (Bull Board)

**Estructura de colas propuesta:**

```typescript
// libros.module.ts
BullModule.registerQueue(
  { name: 'procesar-libro' },
  { name: 'generar-preguntas' },
);

// procesar-libro: concurrency 2-3 por instancia
// generar-preguntas: concurrency 4-6 (límite Groq)
```

**Job payload ejemplo:**

```typescript
interface ProcesarLibroJob {
  libroId: number;
  storageKey: string;  // S3 key o path temporal
  codigo: string;
}
```

**Configuración de reintentos:**

```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
  timeout: 600000, // 10 min
}
```

### 4.5 Manejo de PDFs escaneados (OCR)

**Problema actual:** PDFs solo-imagen se rechazan con mensaje genérico.

**Opciones de OCR:**

| Herramienta | Pros | Contras |
|-------------|------|---------|
| **Tesseract.js** | Gratis, Node puro, multidioma | Más lento, menor precisión que cloud |
| **Google Cloud Vision** | Muy precisa, multidioma | Coste por página |
| **AWS Textract** | Buena calidad, integra con AWS | Coste, dependencia AWS |
| **Azure Document Intelligence** | Alta calidad | Coste |

**Estrategia recomendada (híbrida):**

1. Extraer texto con pdfjs/pdf-parse.
2. Si `texto.length < MIN_TEXT_LENGTH_ESCANEADO` y `numPaginas > 0`:
   - Marcar libro como "requiere_ocr".
   - Encolar job `procesar-libro-ocr` (prioridad baja).
   - Worker: convertir páginas a imágenes (pdf-to-img) → Tesseract por página → concatenar texto → segmentar.
3. Alternativa: ofrecer al admin "Procesar con OCR" como opción explícita (checkbox en el formulario).

**Implementación con Tesseract.js:**

```bash
npm install tesseract.js
```

```typescript
import Tesseract from 'tesseract.js';
// Por cada página como imagen:
const { data: { text } } = await Tesseract.recognize(pageImageBuffer, 'spa');
```

### 4.6 Segmentación de contenido educativo

**Problemas actuales:**

1. Siempre "Unidad 1": no se detectan capítulos reales.
2. Segmentos solo por longitud (~200–500 palabras); no por estructura semántica.

**Mejoras propuestas:**

1. **Detección de capítulos:**

   - Usar patrones `TITULO_CAPITULO` ya definidos en `pdf.constants.ts`.
   - Agrupar párrafos entre títulos de capítulo → crear unidades por capítulo.
   - Si no hay capítulos detectados, mantener "Unidad 1" como ahora.

2. **Segmentación semántica (opcional, más avanzada):**

   - Usar embeddings (OpenAI/Cohere) para similitud entre párrafos.
   - Cortar en puntos de menor similitud (cambio de tema).
   - Requiere más recursos; prioridad media.

3. **Respeto de tablas y listas:**

   - Revisar si la extracción actual rompe tablas (pdfjs extrae por items, puede desordenar).
   - Considerar detección de patrones "1. Item\n2. Item" para no cortar listas a mitad.

4. **Configuración por tipo de libro:**

   - Matemáticas: segmentos más cortos (fórmulas, problemas).
   - Literatura: segmentos más largos (párrafos narrativos).

**Constantes actuales (buenas):** `MIN_WORDS: 200`, `MAX_WORDS: 500`, `TARGET_WORDS: 350`.

### 4.7 Mejoras en generación de preguntas

| Aspecto | Actual | Mejora |
|---------|--------|--------|
| Cola | No existe | Cola `generar-preguntas` con BullMQ |
| Reintentos | Solo en llamada Groq (3) | Reintentos a nivel de job (5) |
| Fallback | Libro queda sin preguntas | Job fallido → reintento automático; endpoint manual `POST /libros/:id/regenerar-preguntas` |
| Calidad | Prompt fijo | Añadir contexto: grado, materia, tipo de contenido |
| Modelo | llama-3.1-8b-instant | Evaluar `llama-3.1-70b` o `mixtral` para preguntas avanzadas |
| Cache | No | Cache de respuestas Groq por hash de contenido (opcional) |
| Batch | 1 llamada por segmento | Mantener; evita perder todo si falla uno |

**Prompt mejorado (ejemplo):**

```typescript
const systemPrompt = `Eres un profesor de ${materia ?? 'educación general'} creando preguntas para alumnos de ${grado}º grado.
Dado un fragmento de libro, genera exactamente 9 preguntas (3 por nivel):
1. BÁSICO: recordar hechos, identificar conceptos.
2. INTERMEDIO: comprender, resumir, aplicar.
3. AVANZADO: analizar, evaluar, relacionar.

Las preguntas deben ser claras y adaptadas al nivel de ${grado}º grado.
Responde ÚNICAMENTE con JSON: {"basico": [...], "intermedio": [...], "avanzado": [...]}`;
```

### 4.8 Sistema de reintentos

**Nivel 1 — Cola BullMQ (jobs):**

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  timeout: 600000,
}
```

**Nivel 2 — Servicio (Groq):** Ya existe en `PreguntasSegmentoService` (3 reintentos, backoff exponencial para 429).

**Nivel 3 — Circuit breaker (opcional):** Si Groq falla > N veces consecutivas, pausar jobs de preguntas temporalmente y alertar.

### 4.9 Escalabilidad a miles de libros

| Componente | Escalado |
|------------|----------|
| API | Horizontal: N instancias detrás de load balancer |
| Workers BullMQ | Múltiples instancias consumiendo la misma cola |
| Redis | Cluster o Redis Enterprise para alta disponibilidad |
| Storage PDFs | Migrar de disco local a **S3** (o MinIO) |
| Base de datos | Índices en `libro.estado`, `libro.codigo`; particionar tablas grandes si crecen mucho |
| Extracción PDF | Workers con límite de memoria; considerar pods/containers con límites |

**Estimación de capacidad (con colas):**

- 1 worker procesando ~2-3 libros/hora (depende del tamaño)
- 4 workers → ~10 libros/hora
- Para 1000 libros/día: ~100 workers o procesamiento en batch nocturno

---

## 5. Herramientas y Librerías Recomendadas

| Propósito | Herramienta | Uso |
|-----------|-------------|-----|
| Colas | **BullMQ** | Procesamiento asíncrono de libros y preguntas |
| Redis | **Redis** (ya típico) | Backend de BullMQ |
| Storage | **AWS S3** / **MinIO** | PDFs en lugar de disco local |
| Validación PDF | **file-type** | Detección real de tipo de archivo |
| Validación estructural | **pdf-lib** | Comprobar que el PDF es abrible |
| OCR | **Tesseract.js** | PDFs escaneados (Node puro) |
| OCR (cloud) | **Google Cloud Vision** | Mayor precisión si hay presupuesto |
| Antivirus | **ClamAV** + `clamscan` | Escaneo de malware en uploads |
| Monitoreo | **Prometheus** + **Grafana** | Métricas de jobs, errores, latencias |
| Alertas | **Sentry** | Errores en workers y API |
| Dashboard colas | **Bull Board** | UI para ver jobs y reintentos |

---

## 6. Plan de Implementación Sugerido

### Fase 1 (prioridad alta)

1. Introducir BullMQ + Redis y cola `procesar-libro`.
2. Cambiar `POST /libros/cargar` a respuestas 202 + encolar.
3. Crear endpoint `GET /libros/:id/estado` con progreso (estado, mensaje).
4. Añadir validación con `file-type` y límite de páginas.

### Fase 2

5. Cola `generar-preguntas` separada.
6. Mejoras de seguridad: rate limit específico, quarantine.
7. Migrar almacenamiento de PDFs a S3 (o equivalente).

### Fase 3

8. Detección de capítulos y unidades reales.
9. OCR con Tesseract para PDFs escaneados (opción manual primero).
10. Prompts mejorados con grado/materia.

### Fase 4

11. Monitoreo y alertas.
12. Revisión de escalado (workers, Redis cluster).

---

## 7. Resumen de Decisiones Clave

| Decisión | Recomendación |
|----------|---------------|
| Cola | BullMQ sobre RabbitMQ (mejor integración NestJS, DX) |
| Procesamiento | Asíncrono obligatorio para libros >10 páginas |
| OCR | Tesseract.js inicial; cloud si se necesita más precisión |
| Storage | S3/MinIO para producción |
| Reintentos | 3 para procesamiento, 5 para preguntas |
| Estados | Extender modelo: `pendiente`, `extrayendo`, `segmentando`, `generando_preguntas`, `listo`, `error` |

---

---

## 8. IMPLEMENTADO (Marzo 2025)

### Cambios aplicados

| Cambio | Archivo/componente |
|--------|--------------------|
| Estados del pipeline | `libro-estado.constants.ts` |
| Validación robusta (buffer, páginas, sanitización) | `libro-upload-validation.service.ts` |
| Detección de capítulos/unidades | `libros-pdf.service.ts` → `procesarPdfConUnidades`, `dividirPorCapítulos` |
| Orquestación de procesamiento | `libro-procesamiento.service.ts` |
| Almacenamiento temporal (para async futuro) | `libro-storage-temp.service.ts` |
| Refactor LibrosService | Usa `LibroProcesamientoService` y `LibroUploadValidationService` |
| Endpoint estado | `GET /libros/:id/estado` |
| Campos BD | `mensaje_error`, `job_id` en tabla Libro |
| Migración | `migrations/add_libro_mensaje_error_job_id.sql` |

### Pendiente (para adoptar cuando se requiera)

- **BullMQ + Redis**: Ver módulo `LibrosQueueModule` en la sección 4 del review. Añadir `@nestjs/bullmq`, `bullmq`, `ioredis` y seguir la arquitectura propuesta.
- **OCR**: Integrar Tesseract.js o servicio cloud para PDFs escaneados.
- **file-type**: Instalar para validación anti-polyglot (opcional).

### Ejecutar migración

```bash
psql -U postgres -d api_lector -f migrations/add_libro_mensaje_error_job_id.sql
```

---

*Documento generado como parte del Technical Design Review del sistema ApiLector.*
