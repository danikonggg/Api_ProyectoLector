# Seguridad de la API Lector

Documento que resume las medidas de seguridad implementadas y el nivel de robustez de la API.

---

## ✅ Resumen: API lista para producción

Con las medidas implementadas, la API está **adecuadamente asegurada** para despliegue en producción, siguiendo buenas prácticas de la industria.

---

## Medidas implementadas

### 1. Autenticación

| Medida | Descripción |
|--------|-------------|
| **JWT** | Tokens firmados con `JWT_SECRET`, expiración 24h |
| **bcrypt** | Contraseñas hasheadas (10 rounds), nunca en texto plano |
| **Validación de credenciales** | Usuario, contraseña y estado `activo` verificados en login |

### 2. Autorización

| Medida | Descripción |
|--------|-------------|
| **Guards por rol** | Admin, Director, Maestro, Alumno con acceso restringido por recurso |
| **Registro de admin** | Solo administradores pueden crear nuevos admins (máx. 5) |
| **Director** | Solo accede a su escuela |
| **Alumno** | Solo ve libros de su escuela |

### 3. Protección de endpoints

| Medida | Descripción |
|--------|-------------|
| **Endpoints de Pruebas** | Desactivados en producción (`NODE_ENV=production` → 404) |
| **Swagger** | Desactivado en producción (no expone documentación) |
| **Registro admin** | Requiere token de administrador |

### 4. Validación y sanitización

| Medida | Descripción |
|--------|-------------|
| **ValidationPipe** | `whitelist`, `forbidNonWhitelisted`, `transform` global |
| **class-validator** | DTOs con validación de tipos, longitudes, formatos |
| **TypeORM** | Consultas parametrizadas (protección frente a SQL injection) |

### 5. Seguridad de red

| Medida | Descripción |
|--------|-------------|
| **CORS** | Orígenes configurados por `CORS_ORIGINS` en producción |
| **Rate limiting** | Throttler: 100 peticiones/minuto por IP |

### 6. Configuración y variables de entorno

| Medida | Descripción |
|--------|-------------|
| **JWT_SECRET** | Validado al arrancar en producción (mín. 32 caracteres) |
| **`.env.example`** | Plantilla documentada, sin secretos |

### 7. Auditoría

| Medida | Descripción |
|--------|-------------|
| **Logs de acciones** | Login, registro admin/padre/alumno/maestro/director, escuelas, libros |
| **Logins fallidos** | Registrados con email, IP y motivo (usuario no encontrado, contraseña incorrecta, usuario inactivo) |
| **Solo admin** | `GET /audit` con paginación, visible solo para administradores |

### 8. Respuestas y errores

| Medida | Descripción |
|--------|-------------|
| **ExceptionFilter global** | Formato unificado de errores |
| **Stack trace** | Solo en desarrollo, nunca en producción |
| **Contraseñas** | `select: false` en entidad Persona |

### 9. Transacciones

| Medida | Descripción |
|--------|-------------|
| **registro_padre** | Operación atómica: persona + padre + vinculación alumno |

---

## Endpoints públicos (sin token)

Solo estos endpoints son accesibles sin autenticación:

| Endpoint | Uso |
|----------|-----|
| `GET /` | Mensaje de bienvenida |
| `GET /health` | Estado de la API y base de datos |
| `POST /auth/login` | Inicio de sesión |

**Todos los demás endpoints requieren JWT.**

---

## Checklist para despliegue en producción

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` con al menos 32 caracteres aleatorios (no usar el de ejemplo)
- [ ] `CORS_ORIGINS` con los dominios del frontend separados por coma
- [ ] Base de datos PostgreSQL con credenciales seguras
- [ ] HTTPS en el proxy/servidor (Nginx, etc.)

---

## Posibles mejoras futuras

| Mejora | Prioridad | Descripción |
|--------|-----------|-------------|
| Helmet | Media | Headers de seguridad HTTP adicionales |
| Rate limit en login | Media | Límite específico (ej. 5 intentos/min) para mitigar fuerza bruta |
| Política de contraseñas | Media | Mínimo 8 caracteres, mayúsculas, números |
| Refresh tokens | Baja | Rotación de tokens sin volver a login |
| Blacklist de tokens | Baja | Invalidar tokens en logout |

---


