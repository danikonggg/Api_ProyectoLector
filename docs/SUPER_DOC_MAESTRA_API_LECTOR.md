# SUPER DOC MAESTRA - API Lector

Fecha: 2026-04-23
Objetivo: unificar en un solo documento tecnico todo lo necesario para estudiar, operar y evolucionar el proyecto.

---

## 0. Como usar este documento

Orden recomendado para estudiarlo:

1. Vision general y arquitectura.
2. Seguridad y modelo de roles.
3. Mapa de modulos y endpoints.
4. Flujos criticos de negocio (personas, escuelas, libros, licencias).
5. Variables de entorno y operacion.
6. Checklist de pruebas y riesgos.

---

## 1. Vision general del sistema

API Lector es un backend educativo construido con NestJS para gestionar:

- usuarios por rol (administrador, director, maestro, alumno, padre)
- escuelas y su operacion academica
- catalogo de libros digitales y procesamiento de PDF
- licencias de acceso a libros por escuela/alumno
- asignaciones de lectura y seguimiento de progreso
- auditoria de acciones criticas

Stack principal:

- NestJS
- TypeORM
- PostgreSQL
- JWT
- BullMQ + Redis
- OpenTelemetry + Prometheus
- Swagger (solo desarrollo)

---

## 2. Arquitectura tecnica

### 2.1 Entradas de aplicacion

API HTTP:

- punto de entrada: src/main.ts
- responsabilidades:
  - bootstrap Nest
  - validacion de entorno
  - validacion global de DTOs
  - CORS
  - helmet
  - excepciones globales
  - Swagger en no produccion

Worker:

- punto de entrada: src/worker.main.ts
- responsabilidades:
  - levantar WorkerModule
  - consumir colas BullMQ
  - telemetria independiente

### 2.2 Composicion de modulos (app.module)

Modulos funcionales:

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

Modulos de infraestructura:

- redis
- queues o noop-queues
- telemetry
- logger pino

### 2.3 Capas y estilo

Patron dominante por dominio:

- Controller: contrato HTTP + permisos
- Service: reglas de negocio
- Repository TypeORM: persistencia
- DTO: validacion de entrada

Observacion de diseno:

- hay servicios extensos (personas, escuelas, licencias) con alta carga de reglas
- la autorizacion se reparte entre controller y service

---

## 3. Modelo de seguridad y acceso

### 3.1 Autenticacion

- login por email/password
- bcrypt para hash de password
- JWT bearer para llamadas protegidas

### 3.2 Autorizacion

Guardas por rol y combinadas:

- AdminGuard
- DirectorGuard
- MaestroGuard
- AlumnoGuard
- AdminOrDirectorGuard
- variantes combinadas

### 3.3 Restriccion multiescuela

Regla general:

- administrador: alcance global
- director: solo su escuela (extraida desde token)
- maestro: operacion acotada a escuela/alumnos asignados
- alumno: solo su propio contexto
- padre: solo su propio contexto

### 3.4 Endpoints publicos

- GET /
- GET /health
- POST /auth/login
- POST /auth/registro-admin (hasta limite)
- GET /personas/admins/cantidad

---

## 4. Mapa de dominios

### 4.1 Auth

Responsabilidades:

- login
- registro de admin inicial
- perfil del autenticado

Rutas clave:

- POST /auth/login
- POST /auth/registro-admin
- GET /auth/profile

### 4.2 Personas

Responsabilidades:

- registro de padre, alumno, maestro, director
- actualizacion y eliminacion de alumno/maestro
- vinculacion padre-alumno por codigo
- consultas por rol

Rutas clave:

- POST /personas/registro-padre
- POST /personas/registro-padre-con-hijo
- POST /personas/registro-alumno
- POST /personas/registro-maestro
- POST /personas/registro-director
- GET /personas/alumnos
- GET /personas/alumnos/buscar
- PATCH /personas/alumnos/:id
- DELETE /personas/alumnos/:id
- PATCH /personas/maestros/:id
- DELETE /personas/maestros/:id
- GET /personas/padres
- GET /personas/padres/:id
- GET /personas/padres/:id/alumnos

### 4.3 Escuelas

Responsabilidades:

- CRUD de escuelas
- vistas de maestros, alumnos, directores por escuela
- operaciones de libros por escuela
- progreso y evaluacion de lectura para alumno
- carga masiva por Excel

Rutas clave:

- POST /escuelas
- GET /escuelas
- GET /escuelas/stats
- GET /escuelas/:id
- PUT /escuelas/:id
- DELETE /escuelas/:id
- GET /escuelas/:id/maestros
- GET /escuelas/:id/alumnos
- GET /escuelas/:id/directores
- GET /escuelas/mis-libros
- PATCH /escuelas/mis-libros/:libroId/progreso
- GET /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion
- POST /escuelas/mis-libros/:libroId/segmentos/:segmentoId/evaluacion
- POST /escuelas/:id/carga-masiva

### 4.4 Libros

Responsabilidades:

- carga y procesamiento de PDF
- gestion de catalogo
- detalle de libro, unidades y segmentos
- descarga de PDF

Rutas clave:

- POST /libros/cargar
- GET /libros
- GET /libros/:id
- GET /libros/:id/pdf
- DELETE /libros/:id

### 4.5 Licencias

Responsabilidades:

- generacion de licencias por lote
- listado y filtrado
- activacion/desactivacion
- canje por alumno/director/maestro

Rutas clave:

- POST /licencias/generar
- GET /licencias
- GET /licencias/escuela/:id
- PATCH /licencias/:id/activa
- POST /licencias/canjear
- GET /licencias/validar/:clave

### 4.6 Director

Responsabilidades:

- dashboard propio
- libros de su escuela
- canje y asignacion

Rutas clave:

- GET /director/dashboard
- GET /director/libros
- GET /director/libros/pendientes
- POST /director/canjear-libro
- POST /director/asignar-libro
- DELETE /director/desasignar-libro/:alumnoId/:libroId

### 4.7 Maestros

Responsabilidades:

- gestion de alumnos asignados
- asignacion/desasignacion de libros

Rutas clave:

- POST /maestros/asignar-alumno
- GET /maestros/mis-alumnos
- GET /maestros/mis-alumnos/:id
- DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId
- POST /maestros/asignar-libro
- DELETE /maestros/desasignar-libro/:alumnoId/:libroId

### 4.8 Admin

Responsabilidades:

- dashboard global
- operacion de usuarios global

Rutas clave:

- GET /admin/dashboard
- GET /admin/usuarios
- PATCH /admin/usuarios/:id
- DELETE /admin/usuarios/:id

### 4.9 Audit

Responsabilidad:

- consulta de bitacora de auditoria

Ruta clave:

- GET /audit

---

## 5. Flujos de negocio criticos

### 5.1 Flujo de inicio de plataforma

1. crear y preparar DB con migraciones.
2. registrar admins iniciales.
3. login admin y obtencion de JWT.
4. crear escuelas.
5. registrar directores/maestros/alumnos/padres.
6. cargar libros.
7. generar/canjear licencias.
8. asignar libros y comenzar lectura.

### 5.2 Flujo de libro y escuela

1. admin carga libro (PDF + metadatos).
2. admin lo publica/disponibiliza por escuela segun modelo operativo.
3. escuela habilita acceso de alumnos via licencia o asignacion.
4. alumno ve libro en mis libros.
5. alumno avanza y registra progreso por segmento.

### 5.3 Flujo de licencias (modelo 1 licencia = 1 alumno)

1. admin genera lote para escuela+libro+vencimiento.
2. se emiten claves unicas.
3. escuela distribuye claves.
4. alumno (o director/maestro) canjea.
5. se crea asociacion alumno-libro.
6. licencia queda usada y no reutilizable.

Validaciones criticas de canje:

- licencia existente
- licencia activa
- no vencida
- no usada
- corresponde a escuela del alumno

### 5.4 Flujo de registro padre + hijo

1. validar escuela del hijo.
2. validar unicidad de correos.
3. crear persona padre y persona alumno.
4. crear vinculo padre-alumno.
5. crear codigo de vinculacion y marcar estado coherente.

### 5.5 Flujo de lectura y evaluacion

1. alumno abre libro asignado.
2. actualiza progreso y segmento.
3. responde evaluacion del segmento.
4. sistema calcula aprobacion.
5. si falla, habilita reintento hasta maximo.

Constantes visibles en EscuelasService:

- umbral aprobacion: 70
- max intentos por evaluacion: 3

---

## 6. Personas (profundo)

### 6.1 Reglas de acceso

- registro de padre: solo admin
- registro de director: solo admin
- registro alumno/maestro: admin o director
- director restringido a su escuela
- padre restringido a su propio contexto

### 6.2 Riesgos funcionales tipicos

- confusion entre id de persona e id de maestro/alumno
- regresiones al tocar DTOs de registro
- seguridad distribuida entre capas

### 6.3 Pruebas minimas recomendadas

1. director no puede operar otra escuela.
2. padre no puede ver padre ajeno.
3. alumno no puede consultar codigo de otro alumno.
4. registro con correo duplicado devuelve conflicto.
5. eliminar maestro elimina relaciones dependientes.

---

## 7. Escuelas (profundo)

### 7.1 Reglas de acceso

- CRUD escuela: admin
- consultas por escuela: admin o director (director solo su escuela)
- lectura mis-libros y progreso: alumno

### 7.2 Carga masiva

- entrada Excel
- tipo alumno/maestro
- validaciones de formato y contenido
- devuelve resumen de creados/errores/credenciales

### 7.3 Riesgos funcionales tipicos

- modulo concentra demasiadas responsabilidades
- reglas de acceso repartidas en controller y service
- cambios en lectura/evaluacion pueden impactar frontend

### 7.4 Pruebas minimas recomendadas

1. director fuera de escuela obtiene 403.
2. alumno sin asignacion no actualiza progreso.
3. carga masiva invalida retorna 400.
4. activacion de libro requiere body valido.
5. evaluacion respeta maximo de intentos.

---

## 8. Libros y procesamiento de PDF

### 8.1 Ciclo tecnico de carga

1. recepcion archivo PDF.
2. persistencia fisica.
3. extraccion de texto.
4. segmentacion por unidades/segmentos.
5. persistencia de estructura de lectura.
6. opcional: generacion de preguntas.

### 8.2 Controles operativos

- limite de tamano de archivo
- validacion de formato
- auditoria de carga y eliminacion
- acceso restringido por rol

---

## 9. Licencias (detalle operativo)

### 9.1 Modelo de datos esperado

Campos representativos:

- clave unica
- libroId
- escuelaId
- alumnoId nullable
- fechaVencimiento
- activa
- fechaAsignacion

Estados logicos:

- disponible
- usada
- vencida

### 9.2 Operacion admin

- generar licencias por lote
- filtrar por escuela/libro/estado
- activar o desactivar claves
- exportar listados para operacion escolar

### 9.3 Operacion escolar

- canje de licencia por alumno
- validacion previa de clave
- reflejo inmediato en mis libros

---

## 10. Auditoria y trazabilidad

Se registran eventos de seguridad y negocio como:

- login / login_fallido
- registro_* por rol
- actualizar_usuario / eliminar_usuario
- escuela_*
- libro_*
- licencia_canjear
- acciones de director y maestro

Objetivo:

- trazabilidad forense
- soporte operativo
- cumplimiento interno

---

## 11. Observabilidad e infraestructura

### 11.1 Logs

- pino estructurado
- contexto de correlacion por request

### 11.2 Metricas

- Prometheus en capa de telemetry

### 11.3 Trazas

- OpenTelemetry en API y worker

### 11.4 Colas

- BullMQ con Redis
- fallback a noop-queues cuando Redis no esta configurado

---

## 12. Variables de entorno clave

- NODE_ENV
- PORT
- DB_HOST
- DB_PORT
- DB_USERNAME
- DB_PASSWORD
- DB_DATABASE
- DB_POOL_SIZE
- DB_LOG_QUERIES
- JWT_SECRET
- JWT_EXPIRES_IN
- CORS_ORIGINS
- THROTTLE_LIMIT_PER_MIN
- GROQ_API_KEY
- REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (segun despliegue)

Recomendaciones:

- JWT_SECRET robusto
- CORS estricto en produccion
- pool de DB alineado con max_connections

---

## 13. Operacion: comandos utiles

Instalacion:

- npm install

Desarrollo:

- npm run start:dev

Build y produccion:

- npm run build
- npm run start:prod

Calidad:

- npm run lint
- npm run test
- npm run test:cov

Worker:

- npm run start:worker

Migraciones auxiliares del repo:

- npm run migration:activo
- npm run migration:grupos

---

## 14. Checklist de pruebas por rol

### 14.1 Admin

1. puede crear escuela.
2. puede registrar director, padre, maestro, alumno.
3. puede listar y actualizar usuarios.
4. puede cargar libro y ver PDF.
5. puede generar y activar/desactivar licencias.

### 14.2 Director

1. no puede operar fuera de su escuela.
2. puede registrar alumno/maestro de su escuela.
3. puede ver panel y libros de su escuela.
4. puede canjear/asignar/desasignar segun reglas.

### 14.3 Maestro

1. solo opera alumnos asignados.
2. asigna y desasigna libros permitidos.
3. no accede a datos globales.

### 14.4 Alumno

1. solo ve sus libros asignados.
2. actualiza progreso de libros validos.
3. responde evaluaciones y respeta intentos.

### 14.5 Padre

1. solo consulta su informacion y la de sus hijos.
2. no accede a otros padres ni alumnos no vinculados.

---

## 15. Riesgos tecnicos actuales

Riesgos altos:

- servicios muy grandes y con multiples responsabilidades
- autorizacion repartida en muchos puntos
- riesgo de regresion por cambios en reglas de escuela/rol

Riesgos medios:

- inconsistencias entre docs viejos y comportamiento actual
- deuda en estandarizacion de codigos de error de negocio

Mitigaciones recomendadas:

1. e2e obligatorias por rol y por frontera de escuela.
2. centralizar politicas de autorizacion.
3. extraer casos de uso por dominio.
4. mantener este super doc sincronizado por release.

---

## 16. Roadmap de mejora documental

1. agregar matrices endpoint a endpoint con DTO de entrada/salida exacta.
2. documentar contratos de error por modulo con ejemplos JSON.
3. anexar diagramas de secuencia por flujo critico.
4. anexar mapa de tablas y relaciones con cardinalidad.
5. registrar changelog por version.

---

## 17. Referencias internas relacionadas

Documentos fuente del repositorio:

- docs/DOCUMENTACION.md
- docs/ARQUITECTURA_GENERAL.md
- docs/PERSONAS_DOCUMENTACION_TECNICA.md
- docs/ESCUELAS_DOCUMENTACION_TECNICA.md
- docs/LICENCIAS_LIBROS.md
- docs/ADMIN_FLUJO_LIBROS_LICENCIAS.md
- docs/ADMIN_DOCUMENTACION_COMPLETA.md

Este archivo actua como vista unificada para estudio y operacion.
