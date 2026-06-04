# 🚀 ApiLector – Resumen Ejecutivo de 1 Página

**ApiLector** es un **Sistema de Gestión Educativa SaaS** que permite a escuelas administrar libros digitales, usuarios y progreso de lectura.

---

## ¿Qué hace ApiLector?

```
Escuela → Carga PDF → Sistema procesa → Alumnos leen → Progreso rastreado
```

### En detalle:

1. **Admin crea escuela** → establece clave base de operaciones
2. **Director/Admin crean usuarios** (maestros, alumnos, padres)
3. **Director sube libros PDF** → sistema procesa automáticamente:
   - Extrae texto
   - Crea segmentos (párrafos)
   - Genera preguntas (Groq IA)
   - Genera imágenes de cada página
   - Extrae palabras clave (glosario)
4. **Director asigna libros a grupos** → todos los alumnos reciben acceso
5. **Alumnos leen en la app** → sistema rastrea:
   - Qué segmento leyeron
   - Cuándo leyeron
   - Respuestas a preguntas
   - Anotaciones personales
6. **Maestro/Director ven progreso** → estadísticas de lectura
7. **Sistema audita TODO** → quién hizo qué, cuándo, desde dónde

---

## Arquitectura en 30 segundos

```
┌──────────────┐
│  Cliente Web │
└──────┬───────┘
       │ REST + JWT
┌──────▼────────────────────────┐
│   API NestJS (controllers)    │
│  (Auth, Personas, Escuelas,   │
│   Libros, Director, etc.)     │
└──────┬───────────────────────┬┘
       │                       │
   ┌───▼──┐           ┌──────┬▼───┐
   │ PostgreSQL        │ Redis +  │
   │ (datos)           │ BullMQ   │
   │                   │ (colas)  │
   └───────┘           └────┬─────┘
                            │
                       ┌────▼──────┐
                       │   Worker   │
                       │ Procesa    │
                       │ PDFs async │
                       └────────────┘
```

---

## Stack Tecnológico

| Capa | Stack |
|------|-------|
| **Lenguaje** | TypeScript + Node.js |
| **Framework** | NestJS 10 |
| **BD** | PostgreSQL + Prisma ORM |
| **Cache/Colas** | Redis + BullMQ |
| **Autenticación** | JWT + bcrypt |
| **IA** | Groq API (generar preguntas) |
| **Storage** | Supabase Storage (PDFs + imágenes) |
| **Observabilidad** | OpenTelemetry, Prometheus, Pino |
| **Testing** | Jest + Supertest |

---

## Módulos del Sistema (9 principales)

| Módulo | Qué hace | Endpoints ejemplo |
|--------|----------|-------------------|
| **auth** | Login JWT | `POST /auth/login` |
| **personas** | CRUD usuarios | `POST /personas/registro` |
| **escuelas** | Centro operativo multi-tenant | `GET /escuelas/:id/libros` |
| **libros** | Upload y procesamiento PDF | `POST /libros/upload` |
| **director** | Dashboard director | `POST /director/asignar-libro` |
| **maestros** | Operaciones maestro | `GET /maestros/:id/mis-alumnos` |
| **alumno** | Perfil y progreso alumno | `GET /alumno/mis-libros` |
| **licencias** | Control de acceso a libros | `POST /licencias/canjear` |
| **audit** | Logging de todas las acciones | `GET /audit/logs` |

---

## Roles del Sistema

```
┌─────────────────────────────────────────────────────┐
│         ADMIN (Sistema completo)                    │
│  ✓ Crear escuelas, libros, usuarios                 │
│  ✓ Ver todo el sistema                              │
└───────────────┬─────────────────────────────────────┘
                │
        ┌───────┴─────────┐
        │                 │
    ┌───▼───────┐   ┌─────▼────────┐
    │ DIRECTOR  │   │ MAESTRO      │
    │ Escuela   │   │ Alumnos      │
    │ Libros    │   │ Tareas       │
    │ Licencias │   │ Progreso     │
    │           │   │ Calificación │
    └───┬───────┘   └─────┬────────┘
        │                 │
        └─────────┬───────┘
                  │
              ┌───▼──────┐
              │  ALUMNO  │
              │ Mis libros
              │ Lectura
              │ Progreso
              └──────────┘

              ┌──────────┐
              │  PADRE   │
              │ Hijo     │
              │ Progreso │
              └──────────┘
```

---

## Flujo Principal (Asignar Libro)

```
1. Director sube PDF
   ↓
2. Sistema procesa (async en worker):
   - Extrae texto
   - Crea segmentos
   - Genera 3 preguntas por segmento (Groq)
   - Convierte a imágenes PNG
   - Extrae palabras clave
   ↓
3. Director tiene 100 preguntas generadas automáticamente
   ↓
4. Director asigna libro a grupo "3A"
   ↓
5. 25 alumnos de 3A reciben libro
   ↓
6. Alumnos leen:
   - Ven página + texto
   - Ven 3 preguntas de comprensión
   - Ven glosario interactivo
   - Hacen anotaciones propias
   ↓
7. Sistema registra TODO:
   - Quién leyó qué
   - Cuándo
   - Cuántas páginas
   - Respuestas
   ↓
8. Maestro ve dashboard:
   - "Juan 40% del libro"
   - "María 100% del libro"
   - "Carlos 10% del libro"
```

---

## Base de Datos (Tablas Clave)

```
Persona (usuario base)
├─ Admin (acceso completo)
├─ Director (escuela) → Escuela
├─ Maestro (escuela) → Escuela
├─ Alumno (escuela, padre) → Escuela, Padre
└─ Padre (vinculado a alumno)

Escuela (tenant)
├─ Libro (N:M) → Escuela_Libro
├─ Alumno (1:N)
└─ Maestro (1:N)

Libro (PDF procesado)
├─ Unidad (capítulos)
  ├─ Segmento (párrafos)
    ├─ PreguntaSegmento (3 preguntas)
    └─ GlosarioSegmento (palabras clave)
├─ Alumno (N:M) → Alumno_Libro
  └─ Progreso (%, último segmento, fecha)
└─ Escuela_Libro (licencia, vigencia)

AuditLog (quién hizo qué, cuándo, desde dónde)
```

---

## Autenticación

```
1. Alumno abre app
2. POST /auth/login { correo, contraseña }
3. API valida y genera JWT
4. JWT = { userId, tipo_persona, escuela_id, exp: +1 hora }
5. Alumno guarda JWT en localStorage
6. Cada request: Authorization: Bearer <JWT>
7. API valida firma y exp
8. Si OK: acceso a /alumno/mis-libros
   Si no: 401 Unauthorized
```

---

## Procesamiento de PDF (Async)

```
Upload PDF (sync)
    ↓
Guardar en Supabase Storage
    ↓
Encolar en BullMQ "libros-import"
    ↓
[Worker procesa async]
    ├─ pdf-parse: extrae texto
    ├─ Normaliza y limpia
    ├─ Segmenta por párrafo
    ├─ Para cada segmento:
    │  ├─ Llama Groq: genera 3 preguntas
    │  ├─ pdf-to-img: convierte a PNG
    │  ├─ NLP: extrae palabras clave
    │  └─ Guarda en BD
    └─ Marca libro como "PROCESADO"

Usuario recibe respuesta inmediata:
"PDF en procesamiento, se notificará cuando esté listo"
```

---

## Auditoría

Cada acción crítica se registra:

```
accion          | usuario_id | ip          | detalles           | fecha
─────────────────────────────────────────────────────────────────
ASIGNAR_LIBRO   | 123        | 192.1.1.1   | libro_id: 456      | 2026-05-18
ALUMNO_LECTURA  | 456        | 192.1.1.2   | segmento_id: 789   | 2026-05-18
LOGIN           | 123        | 192.1.1.1   | null               | 2026-05-18
CREAR_ALUMNO    | 1          | 192.1.1.5   | escuela_id: 5      | 2026-05-18
```

Admin puede ver: "¿Quién leyó qué, cuándo y desde dónde?"

---

## Seguridad

- ✅ Contraseñas hasheadas (bcrypt)
- ✅ JWT con expiración (1 hora)
- ✅ Guards por rol (Admin, Director, Maestro)
- ✅ Validación de escuela_id (aislamiento multi-tenant)
- ✅ CORS restringido
- ✅ Rate limiting (100 req/min por IP)
- ✅ Helmet headers
- ✅ Auditoría de acciones críticas
- ✅ Validación de entrada (DTOs)

---

## Observabilidad

### Logs (Pino)
```
Cada acción genera log JSON:
{ level: "info", module: "libros", action: "UPLOAD", libro_id: 456, ts: "..." }
```

### Métricas (Prometheus)
```
http_request_duration_seconds
db_query_duration_seconds
bullmq_jobs_completed_total
```

### Trazas (Jaeger)
```
http://localhost:16686
Ver duración completa de operación
```

---

## Deployment

### Variables clave:
```
DATABASE_URL        # PostgreSQL
REDIS_HOST          # Redis
JWT_SECRET          # Secret JWT
GROQ_API_KEY        # IA
SUPABASE_URL        # Storage
```

### Comandos:
```
npm run start:dev       # Dev API
npm run start:worker    # Worker (colas)
docker-compose up       # Servicios (PG, Redis, Jaeger)
npm run test            # Tests
```

---

## Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| "Libro stuck PROCESANDO" | Worker offline | `npm run start:worker` |
| "Connection refused PG" | PG no corre | `docker-compose up -d` |
| "Groq API error" | API key inválida | Validar `GROQ_API_KEY` |
| "Upload PDF timeout" | Archivo muy grande | `limit: '500mb'` |

---

## Documentación Completa

👉 **[DOCUMENTACION_TECNICA_COMPLETA.md](./DOCUMENTACION_TECNICA_COMPLETA.md)** – LEER ESTO para entender sistema en profundidad

---

**Última actualización:** 18 de mayo de 2026  
**Versión:** 1.0
