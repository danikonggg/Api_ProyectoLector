# 📚 ApiLector – Sistema de Gestión Educativa Digital

**Backend SaaS educativo** con NestJS que administra:
- 🎓 Usuarios con 5 roles (Admin, Director, Maestro, Alumno, Padre)
- 📚 Libros digitales con procesamiento inteligente de PDFs
- 🏫 Multi-tenant por escuela con aislamiento de datos
- 📖 Seguimiento de progreso de lectura y evaluaciones
- 🔐 Licencias y control de acceso
- 🔍 Auditoría completa y observabilidad
- 🚀 Colas async con BullMQ + Redis

**Stack:** NestJS 10 • TypeScript 5 • PostgreSQL • Prisma • JWT • Groq AI

---

## 📖 Documentación

### Para Principiantes
- [DOCUMENTACION.md](./docs/DOCUMENTACION.md) – Guía rápida: inicio, roles, rutas, seguridad

### Documentación Técnica Completa ⭐
- **[DOCUMENTACION_TECNICA_COMPLETA.md](./docs/DOCUMENTACION_TECNICA_COMPLETA.md)** – **LEER ESTO PRIMERO**
  - Qué es ApiLector y casos de uso
  - Stack tecnológico completo
  - Arquitectura de capas
  - Estructura de carpetas detallada
  - Descripción de todos los módulos
  - Schema de base de datos con ER
  - Sistema de autenticación JWT
  - Todos los flujos principales
  - Endpoints por módulo
  - Procesamiento de PDFs
  - Sistema de colas (BullMQ)
  - Auditoría y logging
  - Observabilidad
  - Licencias y asignaciones
  - Seguridad
  - Deployment
  - Troubleshooting

### Documentos Especializados
- [SUPER_DOC_MAESTRA_API_LECTOR.md](./docs/SUPER_DOC_MAESTRA_API_LECTOR.md) – Mega guía integral
- [ARQUITECTURA_GENERAL.md](./docs/ARQUITECTURA_GENERAL.md) – Vista técnica corta
- [PERSONAS_DOCUMENTACION_TECNICA.md](./docs/PERSONAS_DOCUMENTACION_TECNICA.md) – Módulo Personas
- [ESCUELAS_DOCUMENTACION_TECNICA.md](./docs/ESCUELAS_DOCUMENTACION_TECNICA.md) – Módulo Escuelas
- [LINEAS_BASE_DOCUMENTACION.md](./docs/LINEAS_BASE_DOCUMENTACION.md) – Estándares editoriales

---

## 🚀 Quick Start

### Requisitos
- Node.js 18+
- PostgreSQL 13+
- Redis 6+ (opcional, fallback sync)
- Groq API Key (para IA)

### Instalación

```bash
# 1. Clonar y dependencias
git clone <repo>
cd ApiLector
npm install

# 2. Variables de entorno
cp .env.example .env
# Editar .env con credenciales

# 3. Migraciones BD
npx prisma migrate deploy

# 4. Dev
npm run start:dev

# 5. Worker (procesa PDFs async)
npm run start:worker

# 6. Tests
npm run test
```

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2026-05-18..."}
```

---

## 📊 Módulos Principales

| Módulo | Responsabilidad | Endpoints |
|--------|-----------------|-----------|
| **auth** | Autenticación JWT | POST /auth/login, /auth/register-admin |
| **personas** | CRUD usuarios | GET/POST /personas, PATCH /personas/:id |
| **escuelas** | Multi-tenant hub | GET/POST /escuelas, /escuelas/:id/libros |
| **libros** | PDFs + procesamiento | POST /libros/upload, GET /libros/:id/segmentos |
| **director** | Dashboard director | GET /director/dashboard, POST /director/asignar-libro |
| **maestros** | Gestión maestros | GET /maestros/:id, POST /maestros/:id/asignar-libro |
| **alumno** | Perfil alumno | GET /alumno/mis-libros, GET /alumno/estadisticas |
| **licencias** | Control de acceso | POST /licencias/canjear, GET /licencias |
| **audit** | Logging auditoría | GET /audit/logs (admin) |
| **groq** | IA (preguntas) | POST /groq-test |

---

## 🔐 Roles y Permisos

```
┌─────────────────────────────────────────────────────────┐
│                   ADMINISTRADOR                         │
│  • Crear escuelas, usuarios, libros                     │
│  • Ver sistema completo                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    DIRECTOR       MAESTRO      PADRE
    • Escuela      • Alumnos     • Hijo
    • Libros       • Tareas      • Progreso
    • Licencias    • Progreso
         │
    ALUMNO
    • Mis libros
    • Lectura
    • Progreso
```

---

## 📚 Flujos Principales

### 1. Registrar Alumno
```
Admin/Director → POST /personas/registro
               → Crear Persona + Alumno
               → Vincular a escuela y grado
```

### 2. Subir Libro PDF
```
Admin/Director → POST /libros/upload
               → Validación + Supabase Storage
               → Cola BullMQ (async en worker)
               → Extracción de texto
               → Segmentación
               → Generar preguntas (Groq)
               → Generar imágenes
               → Guardar en BD
```

### 3. Asignar Libro a Grupo
```
Director → POST /director/asignar-libro
         → Validar licencia
         → Crear Escuela_Libro
         → Crear Alumno_Libro para cada alumno
         → Auditar
```

### 4. Alumno Lee Libro
```
Alumno → GET /escuelas/:id/mis-libros-interacciones/:libroId/segmentos
       → Ver página + preguntas + glosario
       → POST /escuelas/:id/alumno-anotaciones
       → Actualizar progreso
       → Auditar lectura
```

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────┐
│      REST Clients (Web, Mobile)      │
└──────────────────┬───────────────────┘
                   │ HTTP/JWT
┌──────────────────▼───────────────────┐
│   Express + NestJS Controllers       │
│  (Auth, Personas, Escuelas, Libros)  │
└──────────────────┬───────────────────┘
                   │
┌──────────────────▼───────────────────┐
│      Business Logic Services         │
│   (CRUD, Validación, Negocio)        │
└──────┬──────────────────────┬────────┘
       │                      │
    ┌──▼───┐         ┌───────▼──┐
    │  BD  │         │ Redis +  │
    │  PG  │         │ BullMQ   │
    └──────┘         └────┬─────┘
                          │
                    ┌─────▼──────┐
                    │   Worker   │
                    │ (async PDF)│
                    └────────────┘
```

---

## 🔧 Variables de Entorno Clave

```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/apilector

# JWT
JWT_SECRET=super_secret_key
JWT_EXPIRATION=3600

# Redis (colas)
REDIS_HOST=localhost
REDIS_PORT=6379

# Groq API (IA)
GROQ_API_KEY=gsk_xxxxx

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Observabilidad
JAEGER_HOST=localhost
JAEGER_PORT=6831
LOG_LEVEL=info

# Server
PORT=3000
NODE_ENV=development
```

---

## 🐳 Docker

```bash
# Servicios (PostgreSQL, Redis, Jaeger)
docker-compose up -d

# API
docker build -f Dockerfile -t apilector:api .
docker run -p 3000:3000 --env-file .env apilector:api

# Worker (procesa colas)
docker build -f Dockerfile.worker -t apilector:worker .
docker run --env-file .env apilector:worker
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 📈 Observabilidad

### Logs (Pino)
```bash
curl http://localhost:3000 2>&1 | grep "level"
# Salida JSON estructurado
```

### Métricas (Prometheus)
```bash
curl http://localhost:3000/metrics
# Formato Prometheus
```

### Trazas (Jaeger)
```
http://localhost:16686
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Connection refused PostgreSQL" | `docker-compose up -d` |
| "Pool error: too many clients" | Aumentar `max_connections` en PG |
| "Libro stuck en PROCESANDO" | Verificar worker: `npm run start:worker` |
| "Groq API error" | Validar `GROQ_API_KEY` en .env |
| "Upload PDF timeout" | Aumentar body limit: `limit: '500mb'` |

---

## � Documentación Completa

### 🌟 Empieza por aquí:

1. **[INDICE_DOCUMENTACION.md](./docs/INDICE_DOCUMENTACION.md)** – Índice centralizado de toda la documentación
2. **[RESUMEN_EJECUTIVO_APILECTOR.md](./docs/RESUMEN_EJECUTIVO_APILECTOR.md)** – 1 página con todo esencial (5 min)
3. **[DOCUMENTACION_TECNICA_COMPLETA.md](./docs/DOCUMENTACION_TECNICA_COMPLETA.md)** – Referencia técnica exhaustiva (60 min)

### 📚 Otros documentos disponibles:

- [DOCUMENTACION.md](./docs/DOCUMENTACION.md) – Guía rápida
- [ARQUITECTURA_GENERAL.md](./docs/ARQUITECTURA_GENERAL.md) – Vista técnica
- [PERSONAS_DOCUMENTACION_TECNICA.md](./docs/PERSONAS_DOCUMENTACION_TECNICA.md) – Módulo Personas
- [ESCUELAS_DOCUMENTACION_TECNICA.md](./docs/ESCUELAS_DOCUMENTACION_TECNICA.md) – Módulo Escuelas
- [SUPER_DOC_MAESTRA_API_LECTOR.md](./docs/SUPER_DOC_MAESTRA_API_LECTOR.md) – Mega guía integral

---

## 💡 Para diferentes roles:

**👨‍💻 Developer:** DOCUMENTACION_TECNICA_COMPLETA.md + ver código en src/  
**🏗️ Tech Lead:** ARQUITECTURA_GENERAL.md + SUPER_DOC_MAESTRA_API_LECTOR.md  
**👥 Product Manager:** RESUMEN_EJECUTIVO_APILECTOR.md + ADMIN_FLUJO_LIBROS_LICENCIAS.md
