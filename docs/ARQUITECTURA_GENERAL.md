# Arquitectura General - API Lector

Fecha: 2026-04-23
Estado: linea base tecnica para onboarding y mantenimiento.

## 1. Vision general

API Lector es un backend NestJS para gestion educativa con multiples roles:

- administrador
- director
- maestro
- alumno
- padre

Objetivos principales:

- autenticacion JWT por rol
- aislamiento por escuela para perfiles operativos
- gestion de escuelas, personas, libros y licencias
- flujo de lectura con progreso y evaluaciones por segmento
- auditoria de acciones y observabilidad

## 2. Entradas de aplicacion

### 2.1 API HTTP

Archivo principal: src/main.ts

Responsabilidades:

- inicializacion de OpenTelemetry
- validacion de variables de entorno
- bootstrap de Nest con logger pino
- hardening base: helmet, body limit 1mb, CORS
- filtros y validacion global (ValidationPipe)
- Swagger habilitado fuera de produccion

### 2.2 Worker

Archivo principal: src/worker.main.ts

Responsabilidades:

- bootstrap de WorkerModule como application context
- servicio OTEL independiente para worker
- ejecucion de colas BullMQ (proceso asyncrono)

## 3. Composicion de modulos

Archivo de composicion: src/app.module.ts

Modulos principales:

- auth
- personas
- escuelas
- maestros
- libros
- materias
- licencias
- director
- admin
- audit
- groq
- infra (redis, telemetry)
- queues o noop-queues segun configuracion redis

Elementos globales:

- APP_GUARD: JwtAuthGuard
- APP_GUARD: ThrottlerGuard
- APP_INTERCEPTOR: AuditHttpInterceptor
- middleware global: correlation id

## 4. Estilo arquitectonico

Patron dominante por modulo:

- controller: contrato HTTP y permisos
- service: reglas de negocio
- repositories TypeORM: persistencia
- DTOs: validacion de entrada

No se observa CQRS formal ni event sourcing de dominio. El modelo es modular por dominio con servicios transaccionales en casos criticos.

## 5. Persistencia y datos

Base de datos: PostgreSQL con TypeORM.

Notas:

- migraciones SQL en carpeta migrations
- entidades distribuidas por dominio
- uso de bandera activo para bajas logicas en varias tablas
- tablas de relacion para asignaciones (escuela-libro, alumno-libro, alumno-maestro)

## 6. Seguridad

### 6.1 Autenticacion

- login por email/password
- bcrypt para hash
- JWT bearer para consumo de API

### 6.2 Autorizacion

Guardas por rol:

- admin
- director
- maestro
- alumno
- combinados (admin/director, etc.)

### 6.3 Restriccion multiescuela

Regla general:

- director y maestro operan en su escuela (segun token)
- alumno solo ve su asignacion de libros
- admin mantiene alcance global

## 7. Observabilidad y auditoria

- logger estructurado con pino (nestjs-pino)
- metricas Prometheus (infra/telemetry)
- trazas OTEL API + worker
- audit log de acciones relevantes

## 8. Integraciones e infraestructura

- Redis para colas BullMQ
- Supabase SDK en dependencias (uso puntual por modulo)
- Dockerfiles y docker-compose para entorno local

## 9. Riesgos tecnicos actuales (linea base)

- control de acceso distribuido entre controller y service, requiere pruebas de regresion por rol
- alta concentracion de logica en servicios grandes (personas/escuelas/licencias)
- riesgo de deuda tecnica por crecimiento de endpoints en controladores extensos

## 10. Recomendaciones inmediatas de documentacion

1. Mantener un documento tecnico por modulo critico (Personas, Escuelas, Licencias).
2. Para cada endpoint: rol, flujo, validaciones, errores y restricciones de escuela.
3. Adjuntar checklist de pruebas por permisos y multitenancy.
4. Registrar riesgos por endpoint (IDOR, fuga de datos, inconsistencias de rol).
