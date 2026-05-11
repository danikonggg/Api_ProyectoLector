# Personas - Documentacion Tecnica

Fecha: 2026-04-23
Cobertura: src/personas/personas.controller.ts y servicios en src/personas/services/*.ts (registro, consulta, gestión, vinculación)

## 1. Proposito del modulo

El modulo Personas concentra alta de usuarios, consulta y mantenimiento de perfiles del sistema:

- padres
- alumnos
- maestros
- directores
- administradores (consulta y conteo)

Tambien maneja vinculacion padre-alumno por codigo y operaciones de administracion sobre alumnos/maestros.

## 2. Componentes clave

- Controller: personas.controller.ts
- Servicios: registro-personas.service.ts, consulta-personas.service.ts, gestion-personas.service.ts, vinculacion-padres.service.ts; carga-masiva.service.ts en la raíz del módulo
- Entidades principales: Persona, Padre, Alumno, Maestro, Director, Administrador, AlumnoVinculacionPadre
- Dependencias clave: AuditService, JwtPersonaLoaderService, DataSource (transacciones)

## 3. Reglas de seguridad y alcance

- registro de padre: solo admin
- registro de director: solo admin
- registro de alumno/maestro: admin o director
- directores solo pueden operar sobre su escuela
- padres solo pueden ver/operar su propio contexto
- rutas de alumno para codigo de vinculacion se limitan al alumno autenticado

## 4. Inventario de endpoints

Base path: /personas

### 4.1 Altas

- POST /registro-padre
- POST /registro-padre-con-hijo
- POST /registro-alumno
- POST /registro-maestro
- POST /registro-director

### 4.2 Vinculacion padre-alumno

- POST /padres/vincular-alumno
- POST /padres/desvincular-alumno
- GET /alumnos/codigo-vinculacion
- GET /alumnos/:id/codigo-vinculacion

### 4.3 Consultas administrativas

- GET /admins
- GET /admins/cantidad
- GET /alumnos
- GET /alumnos/buscar
- GET /alumnos/:id
- GET /alumnos/:id/padre
- GET /padres
- GET /padres/:id
- GET /padres/:id/alumnos

### 4.4 Mantenimiento

- PATCH /alumnos/:id
- DELETE /alumnos/:id
- PATCH /maestros/:id
- DELETE /maestros/:id

## 5. Flujos de negocio criticos

### 5.1 Registro padre

Resumen:

1. valida email unico
2. hashea password con bcrypt
3. crea Persona tipo padre
4. crea registro Padre
5. opcional: vincula alumno por alumnoId
6. registra auditoria

Riesgo controlado:

- se usa transaccion para mantener integridad

### 5.2 Registro padre con hijo

Resumen:

1. valida escuela del hijo
2. valida correo unico de padre y alumno
3. resuelve grupo (por grupoId o por grado+grupo)
4. crea Padre y Alumno en una sola transaccion
5. crea codigo de vinculacion y lo marca usado para evitar reutilizacion

Punto sensible:

- validacion de grupo depende de consistencia de catalogos en escuela

### 5.3 Registro alumno/maestro por director

Regla de frontera:

- si el usuario es director, idEscuela debe coincidir con su escuela del token
- si no se envia idEscuela y es director, se autocompleta con su escuela
- admin debe enviar idEscuela

### 5.4 Consultas por rol

- alumnos/buscar y alumnos/listado aceptan filtro de escuela para admin
- para director se fuerza escuela del token
- padre en rutas propias ignora id externo y usa padre del token para seguridad

## 6. Reglas de integridad

- correo de Persona es unico logico en altas
- password nunca debe exponerse en payload de salida
- auditoria en operaciones de alta/actualizacion/eliminacion
- operaciones de alumno/maestro distinguen id de entidad vs personaId (evita confusiones)

## 7. Errores esperados (mapa rapido)

- 400: parametros faltantes, campo de busqueda invalido, datos inconsistentes
- 401: token ausente/invalido
- 403: rol sin permiso o acceso fuera de escuela
- 404: entidad no encontrada
- 409: email duplicado o conflicto de negocio

## 8. Casos de prueba recomendados

1. Director intenta registrar alumno en otra escuela -> 403.
2. Padre intenta consultar datos de otro padre -> 403.
3. Registro padre+hijo con grupo inexistente -> 400.
4. Eliminacion de alumno por director fuera de su escuela -> 403.
5. Codigo de vinculacion: alumno consulta codigo de otro alumno -> 403.
6. Busqueda de alumnos por director no regresa alumnos de otras escuelas.

## 9. Riesgos y deuda tecnica

- Servicio muy grande: alta densidad de reglas en un solo archivo.
- Multiples rutas con logica de seguridad embebida en controller y service.
- Alto riesgo de regresion cuando se tocan DTOs de registro masivo y vinculacion.

## 10. Recomendacion de evolucion

1. Extraer casos de uso por agregado (registro, vinculacion, mantenimiento).
2. Centralizar reglas de acceso de escuela en politicas reutilizables.
3. Definir pruebas e2e por rol como barrera obligatoria en CI.
