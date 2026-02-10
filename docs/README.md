# Documentación – API Lector (Sistema Educativo)

API REST para un sistema educativo con roles (Administrador, Director, Maestro, Alumno, Padre), autenticación JWT, gestión de escuelas, libros digitales y auditoría.

**Stack:** NestJS, TypeORM, PostgreSQL, JWT, Swagger (solo desarrollo).

---

## Índice

1. [Inicio rápido](#-inicio-rápido)
2. [Arquitectura y roles](#-arquitectura-y-roles)
3. [Documentación por tipo](#-documentación-por-tipo)
4. [Flujos del sistema](#-flujos-del-sistema)
5. [Seguridad y auditoría](#-seguridad-y-auditoría)
6. [Scripts y referencias](#-scripts-y-referencias)

---

## Inicio rápido

### Requisitos

- Node.js 18+
- PostgreSQL
- npm o yarn

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar entorno

Copia `.env.example` a `.env` y ajusta los valores:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_contraseña
DB_DATABASE=api_lector
JWT_SECRET=tu-secret-key-min-32-caracteres
JWT_EXPIRES_IN=24h
CORS_ORIGINS=
```

### 3. Base de datos

Crear la base `api_lector` y ejecutar migraciones en orden:

```bash
psql -U postgres -d api_lector -f migrations/complete_database_setup.sql
psql -U postgres -d api_lector -f migrations/add_audit_log.sql
psql -U postgres -d api_lector -f migrations/add_escuela_libro_pendiente.sql
```

(El resto de migraciones según necesidad: `add_director_table.sql`, `add_libros_unidades_segmentos.sql`, `add_ruta_pdf_libro.sql`, etc.)

### 4. Ejecutar

```bash
npm run start:dev
```

| Recurso        | URL                        |
|----------------|----------------------------|
| API            | `http://localhost:3000`    |
| Swagger        | `http://localhost:3000/api` (solo desarrollo) |
| Health check   | `http://localhost:3000/health` |

---

## Arquitectura y roles

| Rol           | Descripción breve |
|---------------|-------------------|
| **Administrador** | Gestión global: escuelas, directores, padres, libros, auditoría. Máx. 5 admins. |
| **Director**      | Gestión de su escuela: alumnos, maestros, canjear libros. |
| **Maestro**       | Gestión de sus alumnos (por materia): listar, ver, asignar/desasignar. |
| **Alumno**        | Ver y descargar libros asignados a su escuela. |
| **Padre**         | Vinculado a uno o más alumnos (hijos). |

Todos los usuarios se autentican con **email + contraseña** y reciben un **JWT** (24h). Casi todos los endpoints requieren `Authorization: Bearer <token>`.

---

## Documentación por tipo

### Para el equipo frontend (rutas y ejemplos)

| Documento | Contenido |
|-----------|-----------|
| **[RUTAS_ADMIN_FRONTEND.md](./RUTAS_ADMIN_FRONTEND.md)** | Rutas exclusivas de **administrador**: dashboard, personas (admins, alumnos, padres, directores), escuelas, libros, auditoría. Incluye ejemplos de request/response y tabla resumen. |
| **[RUTAS_DIRECTOR_FRONTEND.md](./RUTAS_DIRECTOR_FRONTEND.md)** | Rutas exclusivas de **director**: dashboard de su escuela. |
| **[API_DOCUMENTACION_FRONTEND.md](./API_DOCUMENTACION_FRONTEND.md)** | API completa para frontend: autenticación, personas, escuelas, libros, director, maestros, auditoría, permisos por rol y códigos de error. |
| **[RUTAS_DATOS.md](./RUTAS_DATOS.md)** | Referencia rápida: métodos, rutas y cuerpos mínimos (sin autenticación, auth, personas, escuelas, libros, maestros). |
| **[LIBROS_API_FRONTEND.md](./LIBROS_API_FRONTEND.md)** | Detalle de la API de libros (carga, listado, PDF, asignación a escuelas). |

### Por tema

| Documento | Contenido |
|-----------|-----------|
| **[SEGURIDAD.md](./SEGURIDAD.md)** | Medidas de seguridad (JWT, bcrypt, guards, CORS, rate limiting, validación), endpoints públicos y checklist para producción. |
| **[AUDITORIA.md](./AUDITORIA.md)** | Módulo de auditoría: endpoint `GET /audit`, acciones registradas y migración. |
| **[PRUEBAS_API.md](./PRUEBAS_API.md)** | Endpoints de pruebas (solo desarrollo; en producción devuelven 404). |

---

## Flujos del sistema

| Documento | Contenido |
|-----------|-----------|
| **[FLUJO_SISTEMA.md](./FLUJO_SISTEMA.md)** | **Flujo completo del sistema**: fases (inicialización, auth, escuelas, directores, alumnos, maestros, padres, libros, consultas), guards, matriz de permisos, escenarios típicos y modelo de datos. Es el documento maestro de flujos. |
| **[FLUJO_PADRE_ALUMNO.md](./FLUJO_PADRE_ALUMNO.md)** | Flujo **padre–alumno**: registrar padre e hijo juntos, solo alumno, alumno con padre automático, completar datos del padre, consultas. |
| **[FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md)** | Flujo de **libros**: doble verificación (admin otorga → escuela canjea), endpoints y migración. |

---

## Seguridad y auditoría

- **Autenticación:** JWT (24h), contraseñas con bcrypt.
- **Autorización:** Guards por rol (Admin, Director, AdminOrDirector, Maestro, Alumno, etc.).
- **Endpoints públicos (sin token):** `GET /`, `GET /health`, `POST /auth/login`. Opcionalmente `GET /personas/admins/cantidad` para saber cupo de admins.
- **Producción:** Swagger y endpoints de pruebas desactivados; `JWT_SECRET` mínimo 32 caracteres; CORS y rate limiting configurados.

Ver [SEGURIDAD.md](./SEGURIDAD.md) para detalles y [AUDITORIA.md](./AUDITORIA.md) para logs de acciones.

---

## Scripts y referencias

```bash
npm run start:dev    # Desarrollo con hot-reload
npm run build        # Compilar
npm run start:prod   # Producción
npm run lint         # Linter
```

### Resumen de rutas clave

- **Login:** `POST /auth/login` → `access_token`
- **Admin:** Dashboard `GET /admin/dashboard`, personas, escuelas, libros, `GET /audit`
- **Director:** Dashboard `GET /director/dashboard`, registrar alumnos/maestros (su escuela), canjear libros
- **Alumnos:** Listar `GET /personas/alumnos`, buscar `GET /personas/alumnos/buscar?campo=&valor=`, por ID `GET /personas/alumnos/:id`
- **Libros alumno:** `GET /escuelas/mis-libros`, `GET /libros/:id`, `GET /libros/:id/pdf`

Para listados completos ver [RUTAS_ADMIN_FRONTEND.md](./RUTAS_ADMIN_FRONTEND.md) (tabla resumen al final) y [RUTAS_DATOS.md](./RUTAS_DATOS.md).

---

**Última actualización:** Febrero 2025
