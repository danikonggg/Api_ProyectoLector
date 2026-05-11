# Escuelas - Documentacion Tecnica

Fecha: 2026-04-23
Cobertura: src/escuelas/escuelas.controller.ts y src/escuelas/escuelas.service.ts

## 1. Proposito del modulo

El modulo Escuelas maneja:

- CRUD de escuelas
- vistas operativas por escuela (maestros, alumnos, directores)
- relacion escuela-libro
- asignacion de libros a alumnos
- progreso de lectura y evaluaciones por segmento
- carga masiva de usuarios por Excel

## 2. Componentes clave

- Controller: escuelas.controller.ts
- Service: escuelas.service.ts
- Entidades clave: Escuela, EscuelaLibro, AlumnoLibro, AlumnoSegmentoEvaluacion, MaestroGrupo, Anotacion
- Dependencias: LicenciasService, PreguntasSegmentoService, CargaMasivaService, AuditService

## 3. Seguridad y alcance por rol

- admin: alcance global
- director: alcance restringido a su escuela
- alumno: solo su propio contexto de lectura

Implementacion visible:

- helper directorSoloSuEscuela en controller
- validaciones extra en service para alumnos/directores

## 4. Inventario de endpoints

Base path: /escuelas

### 4.1 Escuelas (admin)

- POST /
- GET /
- GET /stats
- GET /directores
- GET /con-libros
- PUT /:id
- DELETE /:id

### 4.2 Escuelas (admin o director)

- GET /lista
- GET /:id
- GET /:id/maestros
- GET /:id/alumnos
- GET /:id/directores
- GET /alumnos/:alumnoId/libros
- POST /:id/carga-masiva

### 4.3 Libros por escuela (admin)

- GET /:id/libros
- GET /:id/libros/asignaciones
- PATCH /:id/libros/:libroId/activo

### 4.4 Alumno (lectura)

- GET /mis-libros
- PATCH /mis-libros/:libroId/progreso
- GET /mis-libros/:libroId/segmentos/:segmentoId/evaluacion
- POST /mis-libros/:libroId/segmentos/:segmentoId/evaluacion
- POST /mis-libros/:libroId/segmentos/:segmentoId/evaluacion/reintento

### 4.5 Publico

- GET /plantilla-carga-masiva

## 5. Flujos de negocio criticos

### 5.1 Crear escuela

1. valida nombre unico
2. valida clave unica (si se envia)
3. crea escuela con estado activa por default
4. registra auditoria

### 5.2 Listados agregados de escuelas

obtenerTodas construye un agregado por escuela con:

- directores activos
- conteo alumnos
- conteo maestros
- conteo grupos

Incluye paginacion opcional por page/limit.

### 5.3 Carga masiva

1. valida que director no cargue otra escuela
2. valida archivo y tipo (alumno o maestro)
3. parsea Excel segun tipo
4. ejecuta carga masiva
5. retorna resumen + credenciales + excel base64 (si aplica)

### 5.4 Progreso y evaluacion por segmento

- progreso de lectura se actualiza por alumno y libro
- evaluaciones por segmento controlan avance
- existe flujo de reintento por segmento
- constantes de negocio visibles:
  - umbral aprobacion: 70
  - max intentos evaluacion: 3

## 6. Reglas de integridad

- no se elimina escuela con relaciones activas criticas
- escuela-libro maneja bandera activo por escuela
- alumno solo opera libros realmente asignados
- directores no pueden consumir datos de escuelas ajenas

## 7. Errores esperados (mapa rapido)

- 400: body invalido, excel invalido, tipo invalido
- 401: no autenticado
- 403: sin rol o escuela fuera de alcance
- 404: escuela/alumno/libro/asignacion no encontrado
- 409: conflictos de nombre/clave duplicados

## 8. Casos de prueba recomendados

1. Director consulta /escuelas/:id de otra escuela -> 403.
2. Alumno intenta actualizar progreso de libro no asignado -> 404/403 segun regla.
3. PATCH libro activo por escuela con body invalido -> 400.
4. Carga masiva con archivo vacio -> 400.
5. GET /escuelas/lista para director devuelve catalogo valido de escuelas activas.
6. Reintentos de evaluacion respetan maximo configurado.

## 9. Riesgos y deuda tecnica

- Servicio de gran tamano y alcance mixto (CRUD + lectura + evaluacion + anotaciones).
- Multiples responsabilidades en un solo modulo aumentan acoplamiento.
- Reglas de autorizacion distribuidas entre controller y service.

## 10. Recomendacion de evolucion

1. Separar subdominios: escuelas-admin, asignaciones, lectura-evaluacion.
2. Mover reglas de autorizacion a politicas reutilizables por caso de uso.
3. Definir contrato de errores estable para frontend (codigos de negocio).
