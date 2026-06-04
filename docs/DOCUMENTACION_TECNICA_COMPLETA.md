# 📚 ApiLector – Documentación Técnica Completa

**Última actualización:** 18 de mayo de 2026  
**Versión:** 1.0 Final  
**Autor:** Sistema ApiLector

---

## 📖 Tabla de Contenidos

1. [¿Qué es ApiLector?](#qué-es-apilector)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura General](#arquitectura-general)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Módulos del Sistema](#módulos-del-sistema)
6. [Base de Datos](#base-de-datos)
7. [Sistema de Autenticación](#sistema-de-autenticación)
8. [Roles y Permisos](#roles-y-permisos)
9. [Flujos Principales](#flujos-principales)
10. [Endpoints por Módulo](#endpoints-por-módulo)
11. [Procesamiento de Libros PDF](#procesamiento-de-libros-pdf)
12. [Sistema de Colas (BullMQ + Redis)](#sistema-de-colas-bullmq--redis)
13. [Auditoría y Logging](#auditoría-y-logging)
14. [Observabilidad (OpenTelemetry + Prometheus)](#observabilidad-opentelemetry--prometheus)
15. [Licencias y Asignaciones](#licencias-y-asignaciones)
16. [Seguridad](#seguridad)
17. [Deployment y Configuración](#deployment-y-configuración)
18. [Troubleshooting](#troubleshooting)

---

## ¿Qué es ApiLector?

### Propósito
**ApiLector** es un **Sistema de Gestión Educativa Digital SaaS** que permite:
- 🎓 Administrar usuarios con 5 roles diferentes
- 📚 Gestionar libros digitales con procesamiento inteligente de PDFs
- 🏫 Operar en modo **multi-tenant** por escuela
- 📖 Rastrear progreso de lectura por alumno
- 🔐 Controlar licencias y asignaciones de libros
- 🔍 Auditar todas las acciones críticas
- 📊 Obtener métricas en tiempo real

### Casos de Uso Principales
1. **Director de Escuela:** Administra libros, licencias y maestros
2. **Maestro:** Asigna libros a alumnos, revisa progreso
3. **Alumno:** Lee libros digitales, resuelve preguntas, ve progreso
4. **Padre:** Monitorea progreso de su hijo
5. **Administrador:** Gestiona el sistema completo

---

## Stack Tecnológico

| Categoría | Tecnologías |
|-----------|------------|
| **Backend** | NestJS 10, Express, TypeScript 5 |
| **Persistencia** | PostgreSQL, Prisma 7.8, TypeORM (legacy) |
| **Autenticación** | JWT, Passport, bcrypt |
| **Colas Async** | BullMQ 5.72, Redis (ioredis) |
| **Procesamiento PDF** | pdf-parse, pdf-to-img, pdfjs-dist, pdfkit |
| **Oficina** | exceljs, xlsx |
| **IA** | Groq SDK (generación de preguntas) |
| **Storage Cloud** | Supabase Storage |
| **Observabilidad** | OpenTelemetry, Prometheus, Pino |
| **Seguridad** | Helmet, CORS, Rate Limiting |
| **Testing** | Jest, Supertest |

---

## Arquitectura General

### Diagrama de Capas

```
┌─────────────────────────────────────┐
│     Cliente (Web, Mobile, Admin)    │
└──────────────────┬──────────────────┘
                   │ REST API
┌──────────────────▼──────────────────┐
│          API Gateway / Express       │
│    (Middleware: Auth, CORS, RateLimit)
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│       Controllers (REST Endpoints)   │
│ ├─ Auth, Personas, Escuelas         │
│ ├─ Libros, Maestros, Director       │
│ ├─ Alumno, Licencias, Audit         │
│ └─ Admin, Groq                      │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│      Business Logic Services        │
│ ├─ AuthService, RegistroPersonas    │
│ ├─ LibrosService, PdfProcessing     │
│ ├─ EscuelasService, LicenciasService│
│ └─ AuditService, DirectorService    │
└──────────────────┬──────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
      ▼            ▼            ▼
  PostgreSQL    Redis        Supabase
  (Persistencia) (Colas,     (Storage)
                 Cache)
```

### Patrones de Arquitectura
- **Patrón:** NestJS modular con separación por dominio
- **Capas:** Controller → Service → Repository (Prisma/TypeORM)
- **Sin:** CQRS, Event Sourcing (simple y directo)
- **Validación:** class-validator + DTOs
- **Transacciones:** Prisma `$transaction()`

---

## Estructura del Proyecto

```
ApiLector/
├── src/
│   ├── auth/                    # Autenticación y JWT
│   │   ├── decorators/          # @Public, @Admin, @Director, @Maestro
│   │   ├── guards/              # JwtAuthGuard, RoleGuards
│   │   ├── strategies/          # JwtStrategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── personas/                # Gestión de usuarios (CRUD complejo)
│   │   ├── services/
│   │   │   ├── registro-personas.service.ts      # Crear usuario
│   │   │   ├── consulta-personas.service.ts      # Búsqueda/listado
│   │   │   ├── gestion-personas.service.ts       # Actualizar/eliminar
│   │   │   ├── carga-masiva.service.ts           # Importar Excel
│   │   │   └── vinculacion-padres.service.ts     # Vincular padres-hijos
│   │   ├── entities/
│   │   ├── dto/
│   │   ├── personas.controller.ts
│   │   └── personas.module.ts
│   │
│   ├── escuelas/                # Centro operativo
│   │   ├── services/
│   │   │   ├── escuelas.service.ts
│   │   │   ├── estadisticas-escuela.service.ts
│   │   │   ├── consulta-escuela.service.ts
│   │   │   └── application/     # Use cases
│   │   ├── entities/
│   │   ├── escuelas.controller.ts
│   │   ├── alumno-anotaciones.controller.ts
│   │   ├── mis-libros-interacciones.controller.ts
│   │   └── escuelas.module.ts
│   │
│   ├── libros/                  # Procesamiento de PDFs
│   │   ├── services/
│   │   │   ├── libros.service.ts                 # CRUD base
│   │   │   ├── libros-pdf.service.ts             # Extracción de texto
│   │   │   ├── libros-pdf-imagenes.service.ts    # Conversión a imágenes
│   │   │   ├── libro-procesamiento.service.ts    # Segmentación
│   │   │   ├── preguntas-segmento.service.ts     # Generar preguntas (Groq)
│   │   │   ├── glosario-segmento.service.ts      # Palabras clave
│   │   │   ├── supabase-storage.service.ts       # Cloud storage
│   │   │   └── libro-upload-validation.service.ts
│   │   ├── processors/
│   │   ├── libros.controller.ts
│   │   └── libros.module.ts
│   │
│   ├── director/                # Dashboard de director
│   │   ├── director.service.ts
│   │   ├── director.controller.ts
│   │   └── director.module.ts
│   │
│   ├── maestros/                # Gestión de maestros
│   │   ├── maestros.service.ts
│   │   ├── maestros.controller.ts
│   │   └── maestros.module.ts
│   │
│   ├── alumno/                  # Preferencias del alumno
│   │   ├── alumno-preferencias.controller.ts
│   │   ├── alumno-estadisticas.controller.ts
│   │   └── alumno.module.ts
│   │
│   ├── admin/                   # Dashboard administrativo
│   │   ├── admin.service.ts
│   │   ├── admin.controller.ts
│   │   └── admin.module.ts
│   │
│   ├── licencias/               # Gestión de licencias
│   │   ├── licencias.service.ts
│   │   ├── licencias-auto-archiver.service.ts
│   │   ├── licencias.controller.ts
│   │   └── licencias.module.ts
│   │
│   ├── materias/                # Asignaturas
│   │   └── materias.module.ts
│   │
│   ├── audit/                   # Logging de auditoría
│   │   ├── audit.service.ts
│   │   ├── audit.controller.ts
│   │   ├── interceptors/
│   │   └── audit.module.ts
│   │
│   ├── groq/                    # Integración IA (Groq)
│   │   ├── groq.service.ts
│   │   ├── groq.controller.ts
│   │   └── groq.module.ts
│   │
│   ├── queues/                  # BullMQ + Redis
│   │   ├── libros-import.processor.ts
│   │   ├── queues.module.ts
│   │   └── noop-queues.module.ts  # Fallback sin Redis
│   │
│   ├── common/                  # Utilidades globales
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── logger/
│   │   ├── constants/
│   │   └── dto/
│   │
│   ├── infra/                   # Infraestructura
│   │   ├── redis/
│   │   ├── telemetry/
│   │   └── configs/
│   │
│   ├── prisma/
│   │   └── prisma.module.ts
│   │
│   ├── config/
│   ├── app.module.ts            # Root module
│   ├── app.service.ts
│   ├── app.controller.ts
│   ├── main.ts                  # Bootstrap HTTP API
│   └── worker.main.ts           # Bootstrap worker (colas)
│
├── prisma/
│   └── schema.prisma            # Schema Prisma
│
├── migrations/                   # SQL migrations
├── test/                        # Tests
├── scripts/                     # Scripts utilitarios
├── public/                      # Archivos estáticos
├── pdfs/                        # PDFs subidos
├── docker-compose.yml           # Servicios (PostgreSQL, Redis)
├── Dockerfile                   # Imagen API
├── Dockerfile.worker            # Imagen worker
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## Módulos del Sistema

### 1. AuthModule
**Responsabilidad:** Autenticación JWT y Autorización

**Componentes:**
- `AuthService`: Generar JWT, validar credenciales
- `JwtStrategy`: Extrae y valida token JWT
- `JwtAuthGuard`: Guard global que protege endpoints
- `AdminGuard`, `DirectorGuard`, `MaestroGuard`: Guards por rol

**Flujo:**
1. Usuario POST /auth/login con credenciales
2. AuthService verifica contraseña (bcrypt)
3. Genera JWT con userId y role
4. Cliente incluye JWT en header `Authorization: Bearer <token>`
5. Guards validan token en cada request

**Endpoints:**
- `POST /auth/login` - Login
- `POST /auth/register-admin` - Crear primer admin

---

### 2. PersonasModule
**Responsabilidad:** Gestión completa de usuarios

**Servicios:**
- `RegistroPersonasService`: Crear Admin, Director, Maestro, Alumno, Padre
- `ConsultaPersonasService`: Búsqueda, listado, filtros
- `GestionPersonasService`: Actualizar, eliminar, cambiar contraseña
- `CargaMasivaService`: Importar desde Excel
- `VinculacionPadresService`: Vincular padres con alumnos

**Reglas de Negocio:**
- Campo `activo` para soft delete
- Cada usuario tiene `tipo_persona` único
- Alumnos/Maestros/Directores vinculados a `escuela_id`
- Alumnos pueden tener `padre_id` (relación 1:1)

**Endpoints:**
- `POST /personas/registro` - Crear persona
- `GET /personas` - Listar (filtros: rol, escuela, activo)
- `GET /personas/:id` - Obtener por ID
- `PATCH /personas/:id` - Actualizar
- `DELETE /personas/:id` - Eliminar lógico
- `POST /personas/cargar-masivo` - Importar Excel
- `POST /personas/vincular-padre` - Vincular padre-alumno

---

### 3. EscuelasModule
**Responsabilidad:** Hub central de la operación (multi-tenant)

**Servicios:**
- `EscuelasService`: CRUD escuelas, listar libros/alumnos
- `EstadisticasEscuelaService`: Métricas (alumnos activos, libros, licencias)
- `ConsultaEscuelaService`: Búsqueda y filtros

**Reglas de Negocio:**
- Toda operación filtra por `escuela_id` del usuario
- Solo director/admin pueden ver datos de su escuela
- Campo `activo` para archivamiento lógico
- Aislamiento de datos por escuela (multi-tenant)

**Endpoints:**
- `GET /escuelas` - Listar escuelas (solo admin)
- `POST /escuelas` - Crear escuela (solo admin)
- `GET /escuelas/:id` - Detalles
- `PATCH /escuelas/:id` - Actualizar
- `GET /escuelas/:id/libros` - Libros asignados
- `GET /escuelas/:id/estadisticas` - Métricas

---

### 4. LibrosModule
**Responsabilidad:** Gestión y procesamiento de libros PDF

**Servicios:**
- `LibrosService`: CRUD libros
- `LibrosPdfService`: Extracción de texto del PDF
- `LibrosPdfImagenesService`: Conversión PDF → imágenes PNG
- `LibroProcesamiento`: Segmentación, limpieza de texto
- `PreguntasSegmentoService`: Generar preguntas con Groq
- `GlosarioSegmentoService`: Extraer palabras clave
- `SupabaseStorageService`: Subir PDF a cloud
- `LibroUploadValidationService`: Validar archivos

**Flujo de Procesamiento:**
1. Upload PDF → validación (formato, tamaño)
2. Guardar en Supabase Storage
3. Procesar async en cola BullMQ:
   - Extracción de texto → limpieza → segmentación
   - Generar imágenes por página
   - Generar preguntas con Groq
   - Extraer palabras clave para glosario
4. Guardar en BD (Unidades → Segmentos → Preguntas)

**Endpoints:**
- `POST /libros/upload` - Subir PDF
- `GET /libros` - Listar
- `GET /libros/:id` - Detalles (con segmentos)
- `PATCH /libros/:id` - Actualizar metadatos
- `DELETE /libros/:id` - Eliminar
- `GET /libros/:id/segmentos` - Obtener segmentos paginados
- `GET /libros/:id/imagenes` - Obtener imágenes

---

### 5. DirectorModule
**Responsabilidad:** Dashboard y operaciones de director

**Servicios:**
- `DirectorService`: Operaciones específicas de director

**Funcionalidades:**
- Ver estadísticas de escuela
- Asignar maestros a grupos
- Administrar licencias
- Asignar libros a grupos
- Ver progreso de lectura

**Endpoints:**
- `GET /director/dashboard` - Dashboard
- `GET /director/estadisticas` - Métricas
- `POST /director/asignar-libro` - Asignar libro a grupo

---

### 6. MaestrosModule
**Responsabilidad:** Gestión de maestros

**Servicios:**
- `MaestrosService`: Operaciones específicas de maestro

**Funcionalidades:**
- Asignar libros a alumnos
- Ver progreso de alumnos
- Crear anotaciones/preguntas

**Endpoints:**
- `GET /maestros/:id` - Obtener perfil
- `POST /maestros/:id/asignar-libro` - Asignar libro
- `GET /maestros/:id/mis-alumnos` - Listar alumnos asignados

---

### 7. AlumnoModule
**Responsabilidad:** Funcionalidades de alumno

**Servicios:**
- Preferencias de lectura
- Estadísticas de progreso

**Endpoints:**
- `GET /alumno/preferencias` - Obtener preferencias
- `PATCH /alumno/preferencias` - Actualizar preferencias
- `GET /alumno/estadisticas` - Progreso de lectura
- `GET /alumno/mis-libros` - Libros asignados

---

### 8. LicenciasModule
**Responsabilidad:** Gestión de licencias de libros

**Servicios:**
- `LicenciasService`: CRUD licencias
- `LicenciasAutoArchiverService`: Archivamiento automático

**Reglas de Negocio:**
- Escuela canjea licencia → obtiene acceso a libro
- Licencia se archiva si: no hay alumnos activos O pasó fecha_fin
- Campo `archivada` marca licencias vencidas
- Auditar cada transición de licencia

**Estados de Licencia:**
```
Canjeada (activa) → En Uso → Archivada
     ↓
  Pendiente (pre-canje)
```

**Endpoints:**
- `POST /licencias/canjear` - Canjear nueva licencia
- `GET /licencias` - Listar licencias de escuela
- `PATCH /licencias/:id` - Actualizar
- `DELETE /licencias/:id` - Archivar

---

### 9. AuditModule
**Responsabilidad:** Logging de auditoría centralizado

**Servicios:**
- `AuditService`: Registrar acciones críticas

**Qué se audita:**
- Login/logout
- Crear/modificar/eliminar personas
- Asignar libros
- Cambiar licencias
- Cambiar estado de alumno

**Campos registrados:**
- `accion` (string): qué se hizo
- `usuario_id` (bigint): quién lo hizo
- `ip` (string): desde dónde
- `detalles` (JSON): datos adicionales
- `fecha` (timestamp): cuándo

**Endpoints:**
- `GET /audit/logs` - Listar logs (solo admin)
- `GET /audit/logs/:usuarioId` - Filtrar por usuario

---

### 10. GroqModule
**Responsabilidad:** Integración con IA (Groq)

**Servicios:**
- `GroqService`: API a Groq para generar preguntas/definiciones

**Uso:**
- Generar preguntas de comprensión lectura por segmento
- Generar definiciones de palabras del glosario

**Endpoints:**
- `POST /groq-test` - Test de API

---

### 11. QueuesModule
**Responsabilidad:** Procesamiento async con BullMQ

**Colas:**
- `libros-import`: Procesar PDF después de upload

**Procesadores:**
- `LibrosImportProcessor`: Ejecutar procesamiento PDF

**Fallback:**
- `NoopQueuesModule`: Si Redis no está disponible, procesa sync

---

## Base de Datos

### Diagrama ER

```
Persona (PK: id)
├─ tipo_persona: ENUM ['ADMIN','DIRECTOR','MAESTRO','ALUMNO','PADRE']
├─ correo: UNIQUE
├─ activo: BOOLEAN
└─ Relaciones:
   ├─ Admin (1:1)
   ├─ Director (1:1) → Escuela
   ├─ Maestro (1:1) → Escuela
   ├─ Alumno (1:1) → Escuela, Padre
   └─ Padre (1:1)

Escuela (PK: id)
├─ nombre
├─ nivel
├─ activo
└─ Relaciones:
   ├─ Director (1:N)
   ├─ Maestro (1:N)
   ├─ Alumno (1:N)
   ├─ Escuela_Libro (N:M) → Libro
   └─ Escuela_Libro_Pendiente (N:M) → Libro

Libro (PK: id)
├─ titulo
├─ codigo
├─ activo
├─ num_paginas
├─ ruta_pdf
└─ Relaciones:
   ├─ Unidad (1:N)
   ├─ Escuela_Libro (N:M) → Escuela
   ├─ Alumno_Libro (N:M) → Alumno
   └─ Escuela_Libro_Pendiente (N:M) → Escuela

Unidad (PK: id, FK: libro_id)
└─ Relaciones:
   └─ Segmento (1:N)

Segmento (PK: id, FK: libro_id, unidad_id)
├─ contenido: TEXT
├─ numero_pagina: INT
└─ Relaciones:
   ├─ PreguntaSegmento (1:N)
   ├─ GlosarioSegmento (1:N)
   └─ Alumno_Libro.ultimo_segmento_id (FK)

PreguntaSegmento (PK: id, FK: segmento_id)
├─ nivel: ENUM ['BAJO','MEDIO','ALTO']
└─ texto_pregunta: TEXT

GlosarioSegmento (PK: id, FK: segmento_id)
├─ palabra: VARCHAR
├─ definicion: TEXT
└─ frecuencia: INT

Maestro (PK: id, FK: persona_id, escuela_id)
├─ especialidad
├─ activo
└─ Relaciones:
   └─ Alumno_Maestro (1:N) ←→ (N:1) Alumno

Alumno (PK: id, FK: persona_id, escuela_id, padre_id nullable)
├─ grado
├─ grupo
├─ activo
└─ Relaciones:
   ├─ Alumno_Maestro (1:N)
   ├─ Alumno_Libro (N:M) → Libro
   └─ Anotacion (1:N)

Alumno_Maestro (PK: id, FK: alumno_id, maestro_id, materia_id)
├─ fecha_inicio
└─ fecha_fin

Alumno_Libro (PK: id, FK: alumno_id, libro_id)
├─ porcentaje: INT (0-100)
├─ ultimo_segmento_id: FK → Segmento
├─ ultima_lectura: TIMESTAMP
├─ fecha_asignacion: TIMESTAMP
├─ asignado_por_tipo: ENUM ['MAESTRO','DIRECTOR','SISTEMA']
└─ asignado_por_id: BIGINT

Escuela_Libro (PK: id, FK: escuela_id, libro_id)
├─ activo: BOOLEAN
├─ fecha_inicio: DATE
├─ fecha_fin: DATE (nullable)
└─ grupo: VARCHAR (nullable) [asignar a grupo específico]

Escuela_Libro_Pendiente (PK: id, FK: escuela_id, libro_id)
└─ fecha_otorgado: TIMESTAMP

AuditLog (PK: id)
├─ accion: VARCHAR
├─ usuario_id: BIGINT (FK → Persona)
├─ ip: VARCHAR
├─ detalles: JSON (nullable)
└─ fecha: TIMESTAMP (CreateDateColumn)

Anotacion (PK: id, FK: alumno_id, segmento_id)
├─ contenido: TEXT
├─ tipo: ENUM ['NOTA','DUDA','RESUMEN']
├─ fecha_creacion: TIMESTAMP
└─ fecha_actualizacion: TIMESTAMP
```

### Migraciones
Todas en `migrations/` como SQL puro. Ejemplos:
- `add_persona_nombre_apellidos.sql`: Campos de nombre
- `add_libro_materia_optional.sql`: Materia nullable
- `add_anotacion.sql`: Tabla anotaciones
- `add_audit_log.sql`: Tabla auditoría
- `add_alumno_libro.sql`: Progreso de lectura

---

## Sistema de Autenticación

### Flujo JWT

```
1. POST /auth/login { correo, contraseña }
   ↓
2. AuthService.validarCredenciales()
   - Buscar Persona por correo
   - Comparar password con bcrypt
   - Si OK: generar JWT
   ↓
3. JWT = header.payload.signature
   payload = {
     sub: usuarioId,
     tipo_persona: 'MAESTRO',
     escuela_id: 5,
     iat: 1715999999,
     exp: 1716086399
   }
   ↓
4. Cliente guarda JWT en localStorage
5. Cada request:
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ↓
6. JwtAuthGuard valida:
   - Verificar firma
   - Verificar exp
   - Extraer payload
   ↓
7. Si válido: continuar
   Si inválido: 401 Unauthorized
```

### Guards por Rol

```typescript
// Global (todas las rutas excepto @Public)
@UseGuards(JwtAuthGuard)

// Específico de rol
@UseGuards(JwtAuthGuard, AdminGuard)
GET /admin/...

@UseGuards(JwtAuthGuard, DirectorGuard)
POST /director/asignar-libro
```

### Protección Adicional

**Aislamiento por Escuela:**
```typescript
// En service, verificar que usuario y recurso pertenecen a misma escuela
const persona = await getPersona(userId);
const recurso = await getRecurso(resourceId);

if (persona.escuela_id !== recurso.escuela_id) {
  throw new ForbiddenException('No tienes acceso a este recurso');
}
```

---

## Roles y Permisos

### Matriz de Permisos

| Operación | Admin | Director | Maestro | Alumno | Padre |
|-----------|-------|----------|---------|--------|-------|
| Crear usuario | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver usuarios escuela | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modificar usuario | ✅ | ✅ (su escuela) | ❌ | ⚠️ (mismo) | ❌ |
| Crear escuela | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear libro | ✅ | ❌ | ❌ | ❌ | ❌ |
| Asignar libro a grupo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Asignar libro a alumno | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver progreso alumno | ✅ | ✅ | ✅ | ✅ (mismo) | ✅ (hijo) |
| Modificar licencia | ✅ | ✅ | ❌ | ❌ | ❌ |

### Tipo de Acceso
- **Admin:** Sistema completo
- **Director:** Escuela asignada
- **Maestro:** Alumnos asignados + su escuela
- **Alumno:** Sus libros y progreso
- **Padre:** Progreso de hijo vinculado

---

## Flujos Principales

### 1. Flujo: Registrar Alumno

```
Administrador (o Director) solicita crear alumno
                           ↓
POST /personas/registro
{
  nombre: "Juan",
  apellido_paterno: "Pérez",
  tipo_persona: "ALUMNO",
  correo: "juan@escuela.edu",
  contraseña: "Segura123!",
  escuela_id: 5,
  grado: "3ro",
  grupo: "A"
}
                           ↓
RegistroPersonasService:
  1. Validar datos (DTO)
  2. Hash contraseña con bcrypt
  3. Crear Persona (tipo_persona=ALUMNO)
  4. Crear Alumno (persona_id FK, escuela_id FK)
  5. Auditar: "CREATE_ALUMNO"
                           ↓
Response:
{
  id: 123,
  nombre: "Juan",
  tipo_persona: "ALUMNO",
  escuela_id: 5
}
```

### 2. Flujo: Subir Libro PDF

```
Director upload PDF
       ↓
POST /libros/upload
  form-data: file=libro.pdf
       ↓
LibrosController:
  1. Validar archivo (tamaño, tipo)
  2. Subir a Supabase Storage
  3. Crear Libro en BD
  4. Encolar en BullMQ "libros-import"
       ↓
LibrosImportProcessor (async en worker):
  1. Descargar PDF de Supabase
  2. Extracción de texto con pdf-parse
  3. Limpieza de texto (remove blanks, normalizar)
  4. Segmentación por párrafos/páginas
  5. Para cada segmento:
     - Generar imagen con pdf-to-img
     - Llamar Groq para 3 preguntas (BAJO, MEDIO, ALTO)
     - Extraer palabras clave → glosario
  6. Guardar en BD:
     Unidad → Segmento → PreguntaSegmento
                      → GlosarioSegmento
  7. Marcar Libro como "PROCESADO"
       ↓
Response al usuario:
{
  mensaje: "PDF subido y en procesamiento",
  libro_id: 456,
  estado: "PROCESANDO"
}
```

### 3. Flujo: Asignar Libro a Grupo

```
Director solicita asignar libro a grupo
                      ↓
POST /director/asignar-libro
{
  libro_id: 456,
  grupo: "3A"
}
                      ↓
DirectorService:
  1. Verificar: director.escuela_id tiene licencia del libro
  2. Si no: rechazar (requiere licencia primero)
  3. Si sí: crear Escuela_Libro con grupo="3A"
  4. Buscar alumnos en grupo "3A" de esa escuela
  5. Para cada alumno: crear Alumno_Libro
     {
       alumno_id,
       libro_id,
       porcentaje: 0,
       asignado_por_tipo: "DIRECTOR",
       asignado_por_id: director_id
     }
  6. Auditar: "ASSIGN_LIBRO_GRUPO"
                      ↓
Response:
{
  mensaje: "Libro asignado a 25 alumnos del grupo 3A",
  escuela_libro_id: 789
}
```

### 4. Flujo: Alumno Lee Segmento

```
Alumno abre app y lee libro
              ↓
GET /escuelas/:escuela_id/mis-libros-interacciones/:libro_id/segmentos
              ↓
Renderizar segmento:
  - Mostrar imagen de página
  - Mostrar texto
  - Mostrar 3 preguntas (BAJO, MEDIO, ALTO)
  - Mostrar palabras del glosario con tooltips
              ↓
Alumno responde preguntas, interactúa
              ↓
POST /escuelas/:escuela_id/alumno-anotaciones
{
  tipo_anotacion: "RESPUESTA_PREGUNTA" | "NOTA_PERSONAL" | "DUDA",
  contenido: "...",
  segmento_id: 789
}
              ↓
Servicio:
  1. Crear Anotacion
  2. Actualizar Alumno_Libro.ultimo_segmento_id
  3. Calcular porcentaje (segmentos_vistos / total_segmentos)
  4. Auditar: "ALUMNO_LECTURA"
              ↓
Response: { anotacion_id, porcentaje_actualizado }
```

### 5. Flujo: Auto-Archivamiento de Licencias

```
Cada noche (cron job):
          ↓
LicenciasAutoArchiverService:
  1. Buscar licencias activas
  2. Para cada licencia:
     - Contar alumnos activos con Alumno_Libro para ese libro
     - Si count = 0 OR fecha_fin < hoy:
       → Marcar licencia.archivada = true
       → Auditar: "LICENSE_AUTO_ARCHIVED"
  3. Notificar directores si es por vencimiento
          ↓
Log: "Archivadas 5 licencias"
```

---

## Endpoints por Módulo

### Auth
```
POST   /auth/login                    - Login usuario
POST   /auth/register-admin           - Registrar admin inicial
POST   /auth/logout                   - Logout (revoke token)
POST   /auth/refresh                  - Renovar JWT
```

### Personas
```
POST   /personas/registro             - Crear persona
GET    /personas                      - Listar (filters: tipo, escuela, activo)
GET    /personas/:id                  - Obtener por ID
PATCH  /personas/:id                  - Actualizar datos
DELETE /personas/:id                  - Eliminar lógico (activo=false)
POST   /personas/:id/cambiar-password - Cambiar contraseña
POST   /personas/cargar-masivo        - Importar Excel
POST   /personas/vincular-padre       - Vincular padre-alumno
```

### Escuelas
```
POST   /escuelas                      - Crear escuela (admin)
GET    /escuelas                      - Listar escuelas (admin)
GET    /escuelas/:id                  - Detalles escuela
PATCH  /escuelas/:id                  - Actualizar escuela
GET    /escuelas/:id/libros           - Libros de escuela
GET    /escuelas/:id/estadisticas     - Métricas escuela
GET    /escuelas/:id/alumnos          - Alumnos de escuela
GET    /escuelas/:id/maestros         - Maestros de escuela
```

### Libros
```
POST   /libros/upload                 - Subir PDF (async)
GET    /libros                        - Listar libros
GET    /libros/:id                    - Detalles libro
PATCH  /libros/:id                    - Actualizar metadatos
DELETE /libros/:id                    - Eliminar libro
GET    /libros/:id/segmentos          - Segmentos paginados
GET    /libros/:id/segmentos/:segId   - Detalle segmento + preguntas
GET    /libros/:id/imagenes           - Imágenes del PDF
```

### Director
```
GET    /director/dashboard            - Dashboard director
GET    /director/estadisticas         - Métricas escuela
POST   /director/asignar-libro        - Asignar libro a grupo
GET    /director/licencias            - Ver licencias escuela
POST   /director/canjear-licencia     - Canjear nueva licencia
```

### Maestros
```
GET    /maestros/:id                  - Perfil maestro
POST   /maestros/:id/asignar-libro    - Asignar libro a alumno
GET    /maestros/:id/mis-alumnos      - Alumnos asignados
GET    /maestros/:id/reportes         - Reportes de progreso
```

### Alumno
```
GET    /alumno/preferencias           - Preferencias de lectura
PATCH  /alumno/preferencias           - Actualizar preferencias
GET    /alumno/estadisticas           - Progreso de lectura
GET    /alumno/mis-libros             - Libros asignados
GET    /alumno/mis-libros/:id/progreso - Progreso en libro
```

### Escuelas (Interacciones)
```
POST   /escuelas/:id/alumno-anotaciones          - Crear anotación
GET    /escuelas/:id/alumno-anotaciones          - Listar anotaciones
GET    /escuelas/:id/mis-libros-interacciones    - Libros + progreso
GET    /escuelas/:id/mis-libros-interacciones/:libroId/segmentos
       - Segmentos con preguntas
```

### Licencias
```
POST   /licencias/canjear             - Canjear licencia
GET    /licencias                     - Listar licencias
PATCH  /licencias/:id                 - Actualizar licencia
DELETE /licencias/:id                 - Archivar licencia
GET    /licencias/reportes            - Reportes uso
```

### Audit
```
GET    /audit/logs                    - Listar logs (admin)
GET    /audit/logs?usuarioId=:id      - Filtrar por usuario
GET    /audit/logs?accion=:accion     - Filtrar por acción
GET    /audit/logs/export              - Exportar CSV
```

### Admin
```
GET    /admin/dashboard               - Dashboard admin
GET    /admin/usuarios                - Listar todos usuarios
GET    /admin/escuelas                - Estadísticas escuelas
GET    /admin/libros                  - Estadísticas libros
GET    /admin/health                  - Health check servicios
```

### Groq (IA)
```
POST   /groq-test                     - Test Groq API
```

---

## Procesamiento de Libros PDF

### Servicios Involucrados

#### 1. LibrosPdfService
**Extracción de texto del PDF**

```typescript
async extractText(filePath: string): Promise<string>
// Usa: pdf-parse
// Output: texto completo del PDF
```

#### 2. LibrosProcesamiento
**Segmentación y limpieza**

```typescript
async segmentarTexto(texto: string): Promise<Segmento[]>
// 1. Split por párrafos
// 2. Remove blancos extra
// 3. Normalizar encoding
// 4. Output: array de segmentos { contenido, numero_pagina }
```

#### 3. LibrosPdfImagenesService
**Conversión PDF → imágenes PNG**

```typescript
async convertPdfToImages(filePath: string): Promise<string[]>
// Usa: pdf-to-img
// Output: array de URLs de imágenes en Supabase Storage
```

#### 4. PreguntasSegmentoService
**Generar preguntas con Groq**

```typescript
async generarPreguntasSegmento(
  segmento: string
): Promise<PreguntaSegmento[]>

// Llamada a Groq con prompt:
// "Basado en este texto educativo, genera 3 preguntas:
//  1. Nivel BAJO (comprensión básica)
//  2. Nivel MEDIO (análisis)
//  3. Nivel ALTO (pensamiento crítico)"

// Output: array de 3 preguntas con nivel y texto
```

#### 5. GlosarioSegmentoService
**Extraer palabras clave**

```typescript
async extraerGlosario(segmento: string): Promise<Palabra[]>

// 1. NLP para identificar sustantivos/términos clave
// 2. Llamar Groq para generar definición
// 3. Output: { palabra, definicion, frecuencia }
```

#### 6. SupabaseStorageService
**Cloud storage**

```typescript
async uploadFile(file: Buffer, path: string): Promise<string>
// Upload a Supabase Storage
// Output: URL pública del archivo
```

### Pipeline Completo

```
Upload PDF
    ↓
[libros.controller.ts]
    ↓
1. Validación (tamaño, tipo, virus scan)
2. Upload a Supabase
3. Crear Libro en BD
4. Encolar en BullMQ "libros-import"
    ↓
[libros-import.processor.ts] (async, en worker)
    ↓
LibrosPdfService.extractText()
    ↓
LibroProcesamiento.segmentarTexto()
    ↓
For cada Segmento:
  ├─ LibrosPdfImagenesService.convertirSegmento()
  ├─ PreguntasSegmentoService.generarPreguntas()
  ├─ GlosarioSegmentoService.extraerGlosario()
  └─ Guardar en BD
    ↓
Marcar Libro como "PROCESADO"
    ↓
Log: "Libro 456 procesado: 120 segmentos, 360 preguntas"
```

### Validación de PDF

```typescript
// Checklist
- ✅ Tipo: application/pdf
- ✅ Tamaño: < 100MB
- ✅ Legible (pdf-parse no lanza error)
- ✅ Páginas: 5-1000
```

---

## Sistema de Colas (BullMQ + Redis)

### Configuración

```typescript
// Archivo: queues/queues.module.ts

BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: +process.env.REDIS_PORT || 6379,
  },
})

BullModule.registerQueue(
  { name: 'libros-import' }, // Cola para procesar PDFs
)
```

### Cola: libros-import

**Purpose:** Procesar PDF de forma async sin bloquear API

**Job Schema:**
```typescript
interface LibrosImportJob {
  libroId: number;
  filePath: string;
  userId: number;
  escuelaId: number;
}
```

**Procesador:**
```typescript
// Archivo: queues/libros-import.processor.ts

@Processor('libros-import')
export class LibrosImportProcessor {
  @Process()
  async procesarLibro(job: Job<LibrosImportJob>) {
    const { libroId, filePath } = job.data;
    
    try {
      // 1. Extraer texto
      const texto = await this.pdfService.extractText(filePath);
      
      // 2. Segmentar
      const segmentos = await this.procesamiento.segmentarTexto(texto);
      
      // 3. Para cada segmento:
      for (const seg of segmentos) {
        // Generar preguntas
        // Generar imágenes
        // Generar glosario
        // Guardar en BD
      }
      
      // 4. Marcar como procesado
      await this.librosService.markAsProcessed(libroId);
      
      // 5. Auditar
      await this.auditService.log('LIBRO_PROCESADO', libroId);
      
    } catch (error) {
      // Reintento automático (3 intentos por defecto)
      // Si todos fallan: job.moveToFailed()
    }
  }
}
```

**Configuración del Job:**
```typescript
// En LibrosController.upload()

this.librosImportQueue.add(
  {
    libroId: libro.id,
    filePath: supabaseUrl,
    userId: user.id,
    escuelaId: user.escuela_id,
  },
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: true,
  }
);
```

### Fallback: NoopQueuesModule

Si Redis no está disponible:
```typescript
// Archivo: queues/noop-queues.module.ts

// Procesa sincronizado en el mismo thread
// Útil para dev/testing sin Redis
```

---

## Auditoría y Logging

### AuditService

**Qué se audita:**
- ✅ Login/logout
- ✅ CRUD de personas
- ✅ Asignación de libros
- ✅ Cambios de licencias
- ✅ Cambios de estado (alumno activo/inactivo)
- ✅ Importación masiva
- ✅ Cambios de contraseña

**Cómo se registra:**

```typescript
// En servicio
await this.auditService.log(
  'ASIGNAR_LIBRO_GRUPO',
  usuarioId,
  {
    libro_id: 456,
    grupo: '3A',
    cantidad_alumnos: 25,
    escuela_id: 5,
  },
  req.ip
);
```

**Tabla audit_log:**
```
id  | accion               | usuario_id | ip         | detalles            | fecha
----|----------------------|------------|------------|---------------------|---
1   | ASIGNAR_LIBRO_GRUPO  | 123        | 192.1.1.1  | {...JSON...}        | 2026-05-18...
2   | ALUMNO_LECTURA       | 456        | 192.1.1.2  | {...JSON...}        | 2026-05-18...
```

### Pino Logger

```typescript
// src/config/logger.config.ts

export const pinoConfig = {
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { ... } },
};

// Uso en servicios:
this.logger.debug('Iniciando procesamiento PDF', { libroId: 456 });
this.logger.error('Error al procesar PDF', { error, libroId: 456 });
```

---

## Observabilidad (OpenTelemetry + Prometheus)

### OpenTelemetry Setup

```typescript
// src/infra/telemetry/telemetry.module.ts

import { NodeTracerProvider } from '@opentelemetry/node';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  host: process.env.JAEGER_HOST || 'localhost',
  port: +process.env.JAEGER_PORT || 6831,
});

const tracerProvider = new NodeTracerProvider();
tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
```

**Qué se traza:**
- ✅ Requests HTTP (duración, status)
- ✅ Queries a BD (duración, tabla)
- ✅ Llamadas a Groq (duración, modelo)
- ✅ Uploads a Supabase (duración, tamaño)
- ✅ Jobs de colas (duración, estado)

### Prometheus Metrics

```
GET /metrics

# Métrica de requests HTTP
http_request_duration_seconds{method="GET", path="/libros", status="200"} 0.123

# Métrica de BD
db_query_duration_seconds{table="Persona", operation="SELECT"} 0.045

# Métrica de colas
bullmq_jobs_total{queue="libros-import", state="completed"} 1250
bullmq_jobs_failed_total{queue="libros-import"} 3
```

---

## Licencias y Asignaciones

### Modelo de Negocio

```
Escuela canjea licencia de Libro
         ↓
Escuela_Libro_Pendiente (pre-canje)
         ↓
[Director aprueba]
         ↓
Escuela_Libro (activa, fecha_inicio, fecha_fin)
         ↓
Alumnos pueden recibir ese libro
         ↓
Alumno_Libro (progreso del alumno)
         ↓
[Vence fecha O no hay alumnos activos]
         ↓
Escuela_Libro.archivada = true
```

### Estados y Transiciones

```
Pendiente ──[Director canjea]──> Canjeada (activa)
                                     ↓
                         [tiempo/sin alumnos]
                                     ↓
                                Archivada
```

### Servicios

```typescript
// Canjear nueva licencia
async canjearLicencia(
  escuelaId: number,
  libroId: number,
  cantidad: number
): Promise<LicenciaCanjeada>

// Auto-archivar vencidas
async autoArchivarLicencias(): Promise<void>

// Ver licencias de escuela
async obtenerLicencias(
  escuelaId: number,
  filtros?: { archivada?, vencida? }
): Promise<Licencia[]>
```

---

## Seguridad

### Autenticación
- ✅ JWT con expiración (1 hora por defecto)
- ✅ Refresh token (14 días)
- ✅ Contraseñas hasheadas con bcrypt (salt 10)
- ✅ Guards por rol (Admin, Director, Maestro, Alumno)

### Autorización
- ✅ Validación de escuela_id en cada request
- ✅ Solo admin puede ver usuarios de otras escuelas
- ✅ Director solo ve su escuela
- ✅ Maestro solo ve sus alumnos

### Protección de Datos
- ✅ HTTPS en producción
- ✅ CORS configurado (whitelist de origins)
- ✅ Rate limiting global (100 req/min por IP)
- ✅ Helmet headers (no-sniff, x-frame-options, etc.)

### Validación de Entrada
- ✅ DTOs con class-validator
- ✅ Sanitización de input (remove scripts)
- ✅ Whitelist de campos permitidos

### Auditoría
- ✅ Cada acción crítica registrada
- ✅ Incluye usuario, IP, timestamp, detalles
- ✅ No se pueden eliminar logs (PK no permite)

---

## Deployment y Configuración

### Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/apilector

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=tu_secret_super_seguro
JWT_EXPIRATION=3600

# Groq IA
GROQ_API_KEY=gsk_...

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJyyy...

# Observabilidad
JAEGER_HOST=localhost
JAEGER_PORT=6831

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Server
PORT=3000
CORS_ORIGIN=https://frontend.com

# Worker
WORKER_THREADS=4
```

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: apilector
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  jaeger:
    image: jaegertracing/all-in-one
    ports:
      - "6831:6831/udp"
      - "16686:16686"

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/apilector
      REDIS_HOST: redis
      JAEGER_HOST: jaeger

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/apilector
      REDIS_HOST: redis
```

### Comandos útiles

```bash
# Desarrollo
npm run start:dev

# Build producción
npm run build

# Start producción
npm start

# Migraciones Prisma
npx prisma migrate deploy
npx prisma generate

# Tests
npm run test
npm run test:e2e
npm run test:cov

# Linter
npm run lint
npm run format

# Worker (procesa colas)
npm run start:worker
```

---

## Troubleshooting

### Problema: "Pool error: too many clients"

**Causa:** Demasiadas conexiones a PostgreSQL  
**Solución:**
```bash
# Aumentar max_connections en postgresql.conf
max_connections = 200

# O usar Prisma pool
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=10"
```

### Problema: Libro no se procesa (stuck en "PROCESANDO")

**Causa:** Worker offline o Redis desconectado  
**Debug:**
```bash
# Ver estado de cola
redis-cli
> LLEN queue:libros-import:wait

# Checks
- ¿Redis running? `redis-cli ping` → PONG
- ¿Worker running? Ver logs worker
- ¿Job hay error? Ver Redis jobdata
```

**Solución:**
```bash
# Reiniciar worker
npm run start:worker

# Limpiar cola si hay jobs tóxicos
redis-cli
> DEL queue:libros-import:*
```

### Problema: Groq API rate limit

**Causa:** Demasiadas llamadas a Groq en poco tiempo  
**Solución:**
```typescript
// En groq.service.ts, agregar delay
await this.delay(1000); // 1 segundo entre llamadas
```

### Problema: Upload PDF falla por timeout

**Causa:** Archivo muy grande o conexión lenta  
**Solución:**
```bash
# Aumentar timeout en main.ts
app.use(bodyParser.json({ limit: '500mb' }));

# O implementar upload chunked (client side)
```

### Problema: Auditlog table growing too large

**Causa:** Muchos registros acumulados  
**Solución:**
```sql
-- Archivar logs antiguos
CREATE TABLE audit_log_archive AS
SELECT * FROM audit_log
WHERE fecha < NOW() - INTERVAL '1 year';

DELETE FROM audit_log
WHERE fecha < NOW() - INTERVAL '1 year';
```

---

## Referencias

- **NestJS Docs:** https://docs.nestjs.com
- **Prisma Docs:** https://www.prisma.io/docs
- **BullMQ Docs:** https://docs.bullmq.io
- **OpenTelemetry Docs:** https://opentelemetry.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs

---

**Última actualización:** 18 de mayo de 2026  
**Mantener esta documentación sincronizada con cambios en código**
