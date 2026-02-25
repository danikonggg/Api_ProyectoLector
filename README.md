# API Lector – Documentación de arquitectura

Backend NestJS para sistema educativo: roles (Administrador, Director, Maestro, Alumno, Padre), autenticación JWT, escuelas, libros digitales, asignación y progreso de lectura.

**Stack:** NestJS, TypeORM, PostgreSQL, JWT, Swagger (solo desarrollo).

---

## Índice

1. [Resumen estructural](#1-resumen-estructural)
2. [Arquitectura general y módulos](#2-arquitectura-general-y-módulos)
3. [Base de datos (TypeORM)](#3-base-de-datos-typeorm)
4. [Sistema de usuarios y roles](#4-sistema-de-usuarios-y-roles)
5. [Multi-tenant y aislamiento por escuela](#5-multi-tenant-y-aislamiento-por-escuela)
6. [Autenticación y seguridad](#6-autenticación-y-seguridad)
7. [Gestión de libros digitales](#7-gestión-de-libros-digitales)
8. [Asignación y licencias](#8-asignación-y-licencias)
9. [Progreso de lectura](#9-progreso-de-lectura)
10. [API y endpoints](#10-api-y-endpoints)
11. [Lógica de negocio crítica](#11-lógica-de-negocio-crítica)
12. [Problemas potenciales y riesgos](#12-problemas-potenciales-y-riesgos)
13. [Escalabilidad y preparación SaaS](#13-escalabilidad-y-preparación-saas)

---

## 1. Resumen estructural

- **Patrón:** NestJS modular; capas Controller → Service → Repository (TypeORM). Sin CQRS ni eventos de dominio.
- **Módulos:** Auth, Personas, Escuelas, Libros, Director, Maestros, Admin, Audit. Dependencias lineales; Admin y Director consumen PersonasService y EscuelasService.
- **Organización:** `src/` por dominio (auth/, personas/, escuelas/, libros/, director/, maestros/, admin/, common/). Entidades en cada dominio o en `personas/entities/`.
- **Base de datos:** PostgreSQL vía TypeORM; migraciones SQL en `migrations/`. No hay soft delete; se usa campo **activo** en Persona, Director, Maestro, Alumno, Libro, EscuelaLibro.

---

## 2. Arquitectura general y módulos

### Estructura en `src/`

| Ruta | Contenido |
|------|-----------|
| `main.ts` | Bootstrap, ValidationPipe, CORS, Swagger (no prod), Throttler global, body limit 1MB |
| `app.module.ts` | Importa todos los módulos en orden: Auth → Personas → Escuelas → Maestros → Libros → Audit → Admin → Director |
| `app.controller.ts` | Rutas raíz: `/`, `/health`, `/groq-test` |

### Módulos y responsabilidades

| Módulo | Controlador | Servicios principales | Exporta |
|--------|-------------|------------------------|---------|
| **Auth** | AuthController | AuthService, JwtStrategy | AuthService |
| **Personas** | PersonasController | PersonasService, CargaMasivaService | PersonasService, CargaMasivaService |
| **Escuelas** | EscuelasController | EscuelasService | EscuelasService |
| **Libros** | LibrosController | LibrosService, LibrosPdfService, PdfStorageService, PreguntasSegmentoService | LibrosService |
| **Director** | DirectorController | DirectorService | — |
| **Maestros** | MaestrosController | MaestrosService | MaestrosService |
| **Admin** | AdminController | AdminService | — |
| **Audit** | AuditController | AuditService | AuditService (global) |

---

## 3. Base de datos (TypeORM)

### Entidades y tablas

| Entidad | Tabla | PK | Campos principales |
|---------|-------|-----|-------------------|
| **Persona** | `Persona` | id (bigint) | nombre, segundo_nombre, apellido_paterno, apellido_materno, apellido (legacy), correo, telefono, fecha_nacimiento, genero, password, tipo_persona, activo, ultima_conexion |
| **Admin** | `Admin` | id | persona_id (FK → Persona), fecha_alta |
| **Escuela** | `Escuela` | id | nombre, nivel, clave, direccion, telefono, estado, ciudad, estado_region |
| **Director** | `Director` | id | persona_id (FK), escuela_id (FK), fecha_nombramiento, activo |
| **Maestro** | `Maestro` | id | persona_id (FK), escuela_id (FK), especialidad, fecha_contratacion, activo |
| **Alumno** | `Alumno` | id | persona_id (FK), escuela_id (FK), padre_id (FK nullable), grado, grupo, ciclo_escolar, activo |
| **Padre** | `Padre` | id | persona_id (FK), parentesco |
| **Alumno_Maestro** | `Alumno_Maestro` | id | alumno_id (FK CASCADE), maestro_id (FK CASCADE), materia_id (FK), fecha_inicio, fecha_fin |
| **Materia** | `Materia` | id | nombre, descripcion, nivel |
| **Libro** | `Libro` | id | titulo, materia_id (FK nullable), codigo, grado, descripcion, estado, activo, num_paginas, ruta_pdf |
| **Unidad** | `Unidad` | id | libro_id (FK CASCADE), nombre, orden |
| **Segmento** | `Segmento` | id | libro_id (FK CASCADE), unidad_id (FK CASCADE), contenido, numero_pagina, orden, id_externo |
| **PreguntaSegmento** | `PreguntaSegmento` | id | segmento_id (FK CASCADE), nivel, texto_pregunta, orden |
| **Escuela_Libro** | `Escuela_Libro` | id | escuela_id (FK), libro_id (FK), activo, fecha_inicio, fecha_fin, grupo (nullable) |
| **Escuela_Libro_Pendiente** | `Escuela_Libro_Pendiente` | id | escuela_id (FK), libro_id (FK), fecha_otorgado |
| **Alumno_Libro** | `Alumno_Libro` | id | alumno_id (FK CASCADE), libro_id (FK CASCADE), porcentaje, ultimo_segmento_id (FK), ultima_lectura, fecha_asignacion, asignado_por_tipo, asignado_por_id |
| **AuditLog** | `audit_log` | id | accion, usuario_id, ip, detalles, fecha (CreateDateColumn) |

### Relaciones (diagrama lógico)

```
Persona (1) ──< Admin | Director | Maestro | Alumno | Padre (1)
     │
Director ── escuela_id ──> Escuela
Maestro  ── escuela_id ──> Escuela
Alumno   ── escuela_id ──> Escuela, padre_id ──> Padre

Alumno (N) ──< Alumno_Maestro >── (N) Maestro   [materia_id → Materia]

Libro (1) ──< Unidad (1) ──< Segmento (1) ──< PreguntaSegmento
Libro (N) ──< Escuela_Libro >── (N) Escuela     [activo, fecha_inicio/fin, grupo]
Libro (N) ──< Escuela_Libro_Pendiente >── (N) Escuela  [pre-canje]
Alumno (N) ──< Alumno_Libro >── (N) Libro       [porcentaje, ultimo_segmento_id, ultima_lectura, asignado_por_*]
```

### Tablas pivote

- **Alumno_Maestro:** asignación alumno–maestro por materia.
- **Escuela_Libro:** libro disponible en una escuela (tras canje).
- **Escuela_Libro_Pendiente:** libro otorgado por admin a una escuela, pendiente de canje.
- **Alumno_Libro:** asignación alumno–libro + progreso de lectura.

### Soft delete e índices

- No hay `deletedAt`. Se usa campo **activo** (boolean) en Persona, Director, Maestro, Alumno, Libro, EscuelaLibro.
- Índices: los que TypeORM genera por defecto; en migraciones existe `idx_persona_correo` y otros según scripts en `migrations/`.

---

## 4. Sistema de usuarios y roles

### Roles

| Rol | Alcance |
|-----|---------|
| **Administrador** | Todo: escuelas, directores, maestros, alumnos, padres, libros, auditoría. Máx. 5 admins. |
| **Director** | Solo su escuela: alumnos, maestros, canjear libros, asignar libros a alumnos. No envía `idEscuela` en rutas propias (se usa el del token). |
| **Maestro** | Alumnos asignados por materia; asignar/desasignar libros a sus alumnos. |
| **Alumno** | Ver y leer libros asignados; actualizar progreso. |
| **Padre** | Vinculado a uno o más alumnos (hijos). |

### Relación usuario–escuela

- **Director:** `director.escuelaId` (y `director.escuela`) cargados en JWT strategy; todas las rutas `/director/*` usan solo ese ID.
- **Maestro:** `maestro.escuelaId`; solo opera sobre alumnos/libros de su escuela.
- **Alumno:** `alumno.escuelaId`; solo ve libros asignados a él (vía Alumno_Libro).

### Jerarquías

- Admin > Director (por escuela) > Maestro (por escuela). Alumno y Padre son “hojas”.
- Un director no puede ver/modificar datos de otra escuela (salvo riesgos indicados en sección 12).

---

## 5. Multi-tenant y aislamiento por escuela

### Cómo se separan los datos

- **Director:** En rutas `/director/*` el `escuelaId` se obtiene solo del token (`user.director.escuelaId`), nunca del body ni de la URL.
- **Rutas con `:id` de escuela:** En EscuelasController se usa `directorSoloSuEscuela(req.user, id)`: se compara `user.director.escuelaId` con el `id` de la URL; si no coinciden → 403 Forbidden. Aplica a: GET/POST `:id/carga-masiva`, GET `:id/maestros`, GET `:id/alumnos`, GET `:id/directores`, GET `:id`.
- **PersonasController:** Para director se fuerza o valida `idEscuela` contra `user.director.escuelaId` en registro y en listados/actualización/eliminación de alumnos y maestros; el servicio recibe `escuelaId` (undefined para admin, escuela del director para director) y filtra.

### Riesgos de fuga de datos

- **GET /escuelas/lista:** Devuelve **todas** las escuelas activas (id, nombre) también a directores. Fuga acotada (solo id y nombre).
- **Desasignar libro:** Ver sección 12 (IDOR: director/maestro pueden desasignar libros a alumnos de otra escuela).

---

## 6. Autenticación y seguridad

### Login y JWT

- **POST /auth/login** (público, Throttle 5/min). Body: `{ email, password }`.
- AuthService: busca Persona por correo con relaciones (administrador, padre, alumno.escuela, maestro.escuela, director.escuela). Valida bcrypt, que esté activo y (si director/maestro/alumno) que la escuela no esté inactiva/suspendida. Actualiza `ultima_conexion`. Registra en audit (login / login_fallido).
- **Payload JWT:** `{ sub: persona.id, email: persona.correo, tipoPersona: persona.tipoPersona }`.
- Respuesta: `access_token`, token_type Bearer, expires_in 24h, objeto `user`.

### Estrategia JWT y req.user

- **jwt.strategy.ts:** Valida JWT con JWT_SECRET. En `validate(payload)` carga Persona por `payload.sub` con relaciones (administrador, padre, alumno, maestro.escuela, director.escuela). Devuelve la entidad Persona; se asigna a **req.user** (incluye director.escuelaId, maestro.escuelaId, alumno.escuelaId según rol).

### Guards

| Guard | Condición |
|-------|-----------|
| **JwtAuthGuard** | Passport('jwt'). Respeta `@Public()` (no exige token). |
| **AdminGuard** | req.user.tipoPersona === 'administrador' && user.administrador |
| **DirectorGuard** | tipoPersona === 'director' && user.director |
| **MaestroGuard** | tipoPersona === 'maestro' && user.maestro |
| **AlumnoGuard** | tipoPersona === 'alumno' && user.alumno |
| **AdminOrDirectorGuard** | administrador o director |
| **AdminOrDirectorOrAlumnoGuard** | administrador, director o alumno |

### Validaciones críticas

- Contraseñas: bcrypt (10 rounds). No se devuelven en respuestas.
- ValidationPipe global (whitelist, forbidNonWhitelisted, transform). DTOs con class-validator.
- Throttler por IP (configurable; default 500 req/min).

---

## 7. Gestión de libros digitales

### Almacenamiento

- **Libro:** Metadatos (titulo, codigo, grado, materia_id, descripcion, estado, activo) + **ruta_pdf** (ruta en disco/servidor).
- **Unidad / Segmento:** Estructura del contenido (unidades → segmentos). Segmento tiene contenido de texto y numero_pagina, orden.
- **PreguntaSegmento:** Preguntas asociadas a segmentos (nivel, texto_pregunta, orden).

### Control de acceso

- **Admin:** Puede cargar, listar, ver PDF, eliminar libros.
- **Director / Maestro:** Ven libros de su escuela; pueden asignar a alumnos solo libros que estén en Escuela_Libro activa para su escuela.
- **Alumno:** Solo ve libros que tenga asignados en Alumno_Libro (y detalle vía GET /libros/:id si el libro está asignado).

### Verificación de permisos de lectura

- El alumno accede a “mis libros” por GET /escuelas/mis-libros (AlumnoGuard; alumnoId del token).
- GET /libros/:id para alumno está restringido en lógica a libros asignados (Alumno_Libro).

---

## 8. Asignación y licencias

### Libros a escuelas

1. **Otorgar (admin):** `POST /escuelas/:id/libros` con `{ codigo }`. Busca Libro por codigo; crea **Escuela_Libro_Pendiente** (no duplicar si ya existe pendiente o canjeado).
2. **Canjear (admin o director):**  
   - Admin: `POST /escuelas/:id/libros/canjear` con `{ codigo }`.  
   - Director: `POST /director/canjear-libro` con `{ codigo }` (escuelaId del token).  
   Se comprueba pendiente para esa escuela+libro; se crea **Escuela_Libro** y se elimina el pendiente.

### Libros a alumnos

- **Director:** `POST /director/asignar-libro` (body: alumnoId, libroId). EscuelaId del token.
- **Maestro:** `POST /maestros/asignar-libro` (body: alumnoId, libroId). EscuelaId del maestro.
- Lógica: EscuelasService.asignarLibroAlAlumno(escuelaId, alumnoId, libroId, asignadoPorTipo, asignadoPorId). Valida que el alumno sea de esa escuela, que exista Escuela_Libro activa y (según implementación) grado/grupo; crea o actualiza **Alumno_Libro** (fecha_asignacion, asignado_por_tipo, asignado_por_id).

### Códigos y disponibilidad

- Cada **Libro** tiene un **codigo** único. El admin “otorga” a una escuela indicando ese código; la escuela “canjea” con el mismo código. Sin canje, el libro no está disponible en la escuela. No hay modelo explícito de “licencia” con cantidad; un código otorgado genera un registro en Escuela_Libro_Pendiente y tras canje uno en Escuela_Libro.

---

## 9. Progreso de lectura

### Dónde se guarda

- **Alumno_Libro:** campos `porcentaje` (0–100), `ultimo_segmento_id`, `ultima_lectura` (timestamp), además de fecha_asignacion y asignado_por_*.

### Endpoint de actualización

- **PATCH /escuelas/mis-libros/:libroId/progreso** (AlumnoGuard). Body: `{ porcentaje?, ultimoSegmentoId? }` (opcionales; porcentaje 0–100).
- Lógica: EscuelasService.actualizarProgresoLibro(alumnoId del token, libroId, dto). Comprueba que exista Alumno_Libro para ese alumno+libro; actualiza porcentaje (clamped), ultimoSegmentoId si viene; pone ultimaLectura = now; guarda.

### Frecuencia y reanudación

- La frecuencia la define el cliente (frontend/app). No hay cola ni batching en backend. La reanudación se basa en ultimo_segmento_id y porcentaje almacenados.

---

## 10. API y endpoints

### App (públicas o sin guard JWT global)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | getHello |
| GET | `/health` | healthCheck |
| GET | `/groq-test` | testGroq |
| POST | `/groq-test` | groqTestCustom |

### Auth

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/auth/login` | Público (Throttle 5/min) | login |
| POST | `/auth/registro-admin` | Jwt + Admin | registrarAdmin |
| GET | `/auth/profile` | Jwt | getProfile |

### Personas

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/personas/registro-padre` | Jwt + Admin | registrarPadre |
| POST | `/personas/registro-alumno` | Jwt + AdminOrDirector | registrarAlumno |
| POST | `/personas/registro-maestro` | Jwt + AdminOrDirector | registrarMaestro |
| POST | `/personas/registro-director` | Jwt + Admin | registrarDirector |
| GET | `/personas/admins` | Jwt + Admin | obtenerAdmins |
| GET | `/personas/admins/cantidad` | Jwt + Admin | contarAdmins |
| GET | `/personas/alumnos` | Jwt + AdminOrDirector | obtenerAlumnos |
| GET | `/personas/alumnos/buscar` | Jwt + AdminOrDirector | buscarAlumnos |
| GET | `/personas/alumnos/:id` | Jwt + AdminOrDirector | obtenerAlumnoPorId |
| GET | `/personas/alumnos/:id/padre` | Jwt + AdminOrDirector | obtenerPadreDeAlumno |
| PATCH | `/personas/alumnos/:id` | Jwt + AdminOrDirector | actualizarAlumno |
| DELETE | `/personas/alumnos/:id` | Jwt + AdminOrDirector | eliminarAlumno |
| PATCH | `/personas/maestros/:id` | Jwt + AdminOrDirector | actualizarMaestro |
| DELETE | `/personas/maestros/:id` | Jwt + AdminOrDirector | eliminarMaestro |
| GET | `/personas/padres` | Jwt + Admin | obtenerPadres |
| GET | `/personas/padres/:id` | Jwt + Admin | obtenerPadrePorId |
| GET | `/personas/padres/:id/alumnos` | Jwt + Admin | obtenerAlumnosDePadre |

### Escuelas

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/escuelas` | Jwt + Admin | crear |
| GET | `/escuelas` | Jwt + Admin | obtenerTodas |
| GET | `/escuelas/lista` | Jwt + AdminOrDirector | listarParaRegistro |
| GET | `/escuelas/stats` | Jwt + Admin | obtenerEstadisticasPanel |
| GET | `/escuelas/directores` | Jwt + Admin | listarTodosDirectores |
| GET | `/escuelas/con-libros` | Jwt + Admin | listarEscuelasConLibros |
| GET | `/escuelas/plantilla-carga-masiva` | @Public | plantillaCargaMasiva |
| GET | `/escuelas/mis-libros` | Jwt + Alumno | misLibros |
| PATCH | `/escuelas/mis-libros/:libroId/progreso` | Jwt + Alumno | actualizarProgresoLibro |
| GET | `/escuelas/:id` | Jwt + AdminOrDirector | obtenerPorId (directorSoloSuEscuela) |
| PUT | `/escuelas/:id` | Jwt + Admin | actualizar |
| DELETE | `/escuelas/:id` | Jwt + Admin | eliminar |
| POST | `/escuelas/:id/carga-masiva` | Jwt + AdminOrDirector | cargaMasiva (directorSoloSuEscuela) |
| GET | `/escuelas/:id/maestros` | Jwt + AdminOrDirector | listarMaestros (directorSoloSuEscuela) |
| GET | `/escuelas/:id/alumnos` | Jwt + AdminOrDirector | listarAlumnos (directorSoloSuEscuela) |
| GET | `/escuelas/:id/directores` | Jwt + AdminOrDirector | listarDirectores (directorSoloSuEscuela) |
| GET | `/escuelas/:id/libros` | Jwt + Admin | listarLibros |
| GET | `/escuelas/:id/libros/pendientes` | Jwt + Admin | listarLibrosPendientes |
| POST | `/escuelas/:id/libros` | Jwt + Admin | otorgarLibro |
| POST | `/escuelas/:id/libros/canjear` | Jwt + Admin | canjearLibro |
| GET | `/escuelas/:id/libros/asignaciones` | Jwt + Admin | listarAsignacionesLibros |
| PATCH | `/escuelas/:id/libros/:libroId/activo` | Jwt + Admin | setLibroActivoEnEscuela |

### Director (todas Jwt + Director; escuela del token)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/director/dashboard` | getDashboard |
| GET | `/director/escuela` | getMiEscuela |
| GET | `/director/maestros` | getMaestros |
| GET | `/director/alumnos` | getAlumnos |
| GET | `/director/directores` | getDirectores |
| GET | `/director/libros` | getLibros |
| GET | `/director/libros/pendientes` | getLibrosPendientes |
| POST | `/director/canjear-libro` | canjearLibro |
| POST | `/director/carga-masiva` | cargaMasiva |
| GET | `/director/libros-disponibles-para-asignar` | librosDisponiblesParaAsignar (query alumnoId) |
| POST | `/director/asignar-libro` | asignarLibro |
| DELETE | `/director/desasignar-libro/:alumnoId/:libroId` | desasignarLibro |

### Maestros (todas Jwt + Maestro)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/maestros/mis-alumnos` | obtenerMisAlumnos |
| GET | `/maestros/mis-alumnos/:id` | obtenerAlumnoPorId |
| POST | `/maestros/asignar-alumno` | asignarAlumno |
| DELETE | `/maestros/mis-alumnos/:alumnoId/materia/:materiaId` | desasignarAlumno |
| GET | `/maestros/libros-disponibles-para-asignar` | librosDisponiblesParaAsignar (query alumnoId) |
| POST | `/maestros/asignar-libro` | asignarLibro |
| DELETE | `/maestros/desasignar-libro/:alumnoId/:libroId` | desasignarLibro |

### Libros

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/libros/cargar` | Jwt + Admin | cargar (multipart PDF) |
| GET | `/libros` | Jwt + Admin | listar |
| GET | `/libros/:id` | Jwt + AdminOrDirectorOrAlumno | obtenerPorId (alumno: solo si asignado) |
| GET | `/libros/:id/pdf` | Jwt + Admin | descargarPdf |
| GET | `/libros/:id/escuelas` | Jwt + Admin | listarEscuelasDeLibro |
| PATCH | `/libros/:id/escuelas/:escuelaId/activo` | Jwt + Admin | setLibroActivoEnEscuela |
| PATCH | `/libros/:id/activo` | Jwt + Admin | setActivo |
| DELETE | `/libros/:id` | Jwt + Admin | eliminar |

### Admin

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| GET | `/admin/dashboard` | Jwt + Admin | getDashboard |
| GET | `/admin/usuarios` | Jwt + Admin | getUsuarios |
| PATCH | `/admin/usuarios/:id` | Jwt + Admin | actualizarUsuario |
| DELETE | `/admin/usuarios/:id` | Jwt + Admin | eliminarUsuario |

### Audit

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| GET | `/audit` | Jwt + Admin | findAll (paginado) |

---

## 11. Lógica de negocio crítica

### Validaciones importantes

- **Máximo 5 administradores:** AuthService.registrarAdmin usa `MAX_ADMINS = 5`; lanza ConflictException si se alcanza.
- **Máximo 3 directores por escuela:** PersonasService.registrarDirector usa `MAX_DIRECTORES_POR_ESCUELA = 3`; lanza ConflictException si la escuela ya tiene 3.
- **Email único:** En todos los registros (padre, alumno, maestro, director, admin) se comprueba que el correo no esté en uso.
- **Escuela activa:** Login rechaza director/maestro/alumno si la escuela está inactiva o suspendida.

### Transacciones

- **PersonasService.registrarPadre:** transacción que crea Persona + Padre y vincula alumnos (padreId).
- **PersonasService.eliminarUsuarioPorId:** transacción que borra rol (AlumnoMaestro, Alumno, Maestro, Director, Admin, Padre) y luego Persona.
- No hay transacciones en otorgar/canjear libro ni en asignar/desasignar libro.

### Automatizaciones

- Al desactivar/suspender una escuela se aplica cascada de desactivación a alumnos, maestros, directores y Escuela_Libro (EscuelasService.actualizar).

---

## 12. Problemas potenciales y riesgos

### Seguridad

| Riesgo | Severidad | Descripción |
|--------|-----------|-------------|
| **IDOR en desasignar libro** | Alta | `DELETE /director/desasignar-libro/:alumnoId/:libroId` y `DELETE /maestros/desasignar-libro/:alumnoId/:libroId` no comprueban que el alumno pertenezca a la escuela del director/maestro. Un director o maestro puede desasignar libros a alumnos de otra escuela. |
| **Fuga en /escuelas/lista** | Media | El director puede ver lista de todas las escuelas (id, nombre). Recomendación: restringir a su escuela. |

### Escalabilidad y rendimiento

| Riesgo | Severidad | Descripción |
|--------|-----------|-------------|
| **Carga de PDF síncrona** | Media | POST /libros/cargar procesa el PDF en la request (límite 50 MB); no hay cola. Puede bloquear y causar timeouts. |
| **Posible N+1** | Media | Listados con find + relations (ej. escuelas con libros, alumnos con padre) pueden generar N+1 en listas grandes. |
| **Sin transacciones en flujo libro** | Baja | Canje y asignación/desasignación no usan transacción; en fallos parciales podría quedar estado inconsistente. |

### Duplicación de lógica

- Carga masiva: misma CargaMasivaService; admin usa `:id` en URL, director usa escuela del token (validado con directorSoloSuEscuela).
- Canjear libro: admin usa `/escuelas/:id/libros/canjear`; director usa `/director/canjear-libro`; misma lógica en EscuelasService.canjearLibroPorCodigo.

### Rutas públicas

- `/health`, `/groq-test` están expuestas. Asegurar que no devuelvan información sensible.

---

## 13. Escalabilidad y preparación SaaS

### Nivel de escalabilidad actual

- Una instancia orientada a ~200 usuarios concurrentes (pool 80, throttle 500 req/min por IP).
- Carga de PDF y procesamiento pesado en la misma instancia limitan escalado horizontal sin cola.
- Modelo relacional claro; escalado vertical de BD viable. Sin particionado ni sharding por escuela.
- JWT stateless; adecuado para varias instancias detrás de balanceador si el trabajo pesado se externaliza.

### Preparación para SaaS: **MEDIA**

**A favor:**

- Aislamiento por escuela en la mayoría de endpoints (director sin elegir escuela en URL en `/director/*`, directorSoloSuEscuela donde se usa `:id`).
- Límites de negocio (5 admins, 3 directores por escuela).
- Auditoría de login y acciones sensibles.
- Roles bien separados con guards.

**En contra:**

- IDOR en desasignar libro (riesgo multi-tenant grave).
- Listado de escuelas visible para directores.
- Ausencia de transacciones en flujos libro-escuela-alumno donde sería deseable.
- Procesamiento de PDF bloqueante y posibles N+1.

**Para subir a “alta” preparación SaaS:**

1. Corregir desasignar libro: validar que el alumno pertenezca a la escuela del director o (para maestro) a la escuela del maestro y/o a sus alumnos asignados.
2. Restringir GET /escuelas/lista para directores a su escuela (o solo id/nombre de su escuela).
3. Valorar transacciones en canje, asignación y desasignación.
4. Externalizar procesamiento de PDF a cola (worker).
5. Revisar queries (QueryBuilder/joins) para evitar N+1 en listados grandes.

---

## Referencias

- Documentación funcional de la API: `docs/DOCUMENTACION.md`
- Migraciones SQL: carpeta `migrations/`
- Variables de entorno: `.env.example`

*Última actualización: Febrero 2025*
