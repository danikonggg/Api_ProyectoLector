# Líneas Base de Documentación - API Lector

Fecha: 2026-04-23
Objetivo: establecer un marco inicial para documentar el proyecto de forma consistente y priorizada.

## 1) Qué se documenta primero

Prioridad por impacto y tamaño del código (líneas aproximadas):

1. Personas
- `src/personas/services/registro-personas.service.ts`
- `src/personas/services/consulta-personas.service.ts`
- `src/personas/services/gestion-personas.service.ts`
- `src/personas/personas.controller.ts` (~730)
- `src/personas/carga-masiva.service.ts` (~585)

2. Escuelas
- `src/escuelas/escuelas.service.ts` (CRUD escuela, libros, asignaciones; delega evaluación, anotaciones y progreso)
- `src/escuelas/services/alumno-evaluacion-segmento.service.ts`
- `src/escuelas/services/alumno-anotaciones-progreso.service.ts`
- `src/escuelas/escuelas.controller.ts` (~727)

3. Licencias
- `src/licencias/licencias.service.ts` (~1097)
- `src/licencias/licencias.controller.ts` (~288)

4. Libros
- `src/libros/libros-pdf.service.ts` (~659)
- `src/libros/libros.service.ts` (~486)
- `src/libros/libros.controller.ts` (~416)
- `src/libros/preguntas-segmento.service.ts` (~450)
- `src/libros/glosario-segmento.service.ts` (~459)

5. Director y Maestros
- `src/director/director.controller.ts` (~457)
- `src/director/director.service.ts` (~442)
- `src/maestros/maestros.service.ts` (~269)
- `src/maestros/maestros.controller.ts` (~256)

## 2) Líneas editoriales (estándar)

Cada módulo debe incluir:

1. Propósito del módulo
- Qué resuelve y qué no resuelve.

2. Responsabilidades por capa
- Controller: endpoints y permisos.
- Service: reglas de negocio.
- Entity/Repositorio: persistencia.

3. Flujo funcional principal
- Caso feliz (entrada, validación, resultado).
- Casos de error y códigos HTTP.

4. Seguridad y permisos
- Guard usado.
- Restricciones por rol y escuela.

5. Dependencias
- Servicios externos o módulos internos consumidos.

6. Riesgos y deuda técnica
- Posibles fugas de datos.
- Puntos propensos a regresiones.

7. Pruebas recomendadas
- Unitarias mínimas.
- Integración/e2e críticas.

## 3) Plantilla corta por endpoint

Usar esta plantilla en la documentación de rutas:

- Ruta:
- Método:
- Rol autorizado:
- DTO entrada:
- Validaciones clave:
- Flujo interno (resumen):
- Respuesta exitosa:
- Errores esperados:
- Notas de seguridad/multitenant:

## 4) Mapa general del sistema (primera versión)

- Framework: NestJS modular.
- Entrada app: `src/main.ts`.
- Composición de módulos: `src/app.module.ts`.
- Auth y JWT: `src/auth`.
- Dominios principales: `personas`, `escuelas`, `libros`, `licencias`, `director`, `maestros`.
- Observabilidad: OpenTelemetry + Prometheus en `src/infra/telemetry`.

## 5) Entregables de la fase 1 de documentación

1. Documento de arquitectura breve (contexto, módulos, seguridad, despliegue).
2. Documento profundo de Personas.
3. Documento profundo de Escuelas.
4. Documento profundo de Licencias.
5. Checklist de pruebas por módulo crítico.

## 6) Criterio de calidad para dar un módulo por documentado

- Se entiende el flujo sin abrir el código.
- Se identifican permisos por rol sin ambigüedad.
- Se cubren errores de negocio y validación.
- Se listan riesgos y pruebas sugeridas.
