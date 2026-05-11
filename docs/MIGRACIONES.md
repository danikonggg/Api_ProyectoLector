# Migraciones de Base de Datos — ApiLector

Documentación de todos los archivos SQL en la carpeta `migrations/`. Describe el propósito, tablas afectadas y dependencias de cada migración.

---

## Orden de ejecución

> **Instalación nueva:** ejecutar únicamente `complete_database_setup.sql` + `seed_lectura.sql`.  
> **Base de datos existente:** aplicar en el orden listado abajo.

```
1.  complete_database_setup.sql
2.  seed_lectura.sql
3.  add_grupo_table.sql
4.  add_alumno_grupo_id.sql
5.  backfill_alumno_grupo_id.sql
6.  add_activo_alumno_maestro_director.sql
7.  add_alumno_libro.sql
8.  add_alumno_segmento_evaluacion.sql
9.  add_alumno_vinculacion_padre.sql
10. add_anotacion.sql
11. add_sesion_lectura.sql
12. add_preferencias_alumno.sql
13. add_audit_log.sql
14. add_director_table.sql
15. add_editorial_libro.sql
16. add_escuela_estado_ciudad_region.sql
17. add_escuela_libro_grupo.sql
18. add_escuela_libro_pendiente.sql
19. add_glosario_segmento_cache.sql
20. add_indexes.sql
21. add_libro_activo.sql
22. add_libro_mensaje_error_job_id.sql
23. add_libros_unidades_segmentos.sql
24. add_licencia_libro.sql
25. add_licencia_libro_archivada.sql
26. add_maestro_grupo_table.sql
27. add_persona_nombre_apellidos.sql
28. add_pregunta_segmento.sql
29. add_ruta_pdf_libro.sql
30. add_ultima_conexion_persona.sql
31. escuela_libro_unique.sql
32. make_libro_materia_optional.sql
33. drop_apellido_column.sql   ⚠️ destructivo — ejecutar al final
34. drop_segundo_nombre.sql    ⚠️ destructivo — ejecutar al final
```

---

## Resumen

| Archivo | Tabla(s) | Tipo |
|---|---|---|
| `complete_database_setup.sql` | Todas | Script maestro |
| `seed_lectura.sql` | Materia | INSERT (seed) |
| `add_grupo_table.sql` | Grupo | CREATE TABLE |
| `add_alumno_grupo_id.sql` | Alumno | ALTER TABLE |
| `backfill_alumno_grupo_id.sql` | Alumno | UPDATE (backfill) |
| `add_activo_alumno_maestro_director.sql` | Alumno, Maestro, Director | ALTER TABLE |
| `add_alumno_libro.sql` | Alumno_Libro | CREATE TABLE |
| `add_alumno_segmento_evaluacion.sql` | Alumno_Segmento_Evaluacion | CREATE TABLE |
| `add_alumno_vinculacion_padre.sql` | Alumno_Vinculacion_Padre | CREATE TABLE |
| `add_anotacion.sql` | Anotacion | CREATE TABLE |
| `add_audit_log.sql` | audit_log | CREATE TABLE |
| `add_director_table.sql` | Director | CREATE TABLE |
| `add_editorial_libro.sql` | Libro | ALTER TABLE |
| `add_escuela_estado_ciudad_region.sql` | Escuela | ALTER TABLE |
| `add_escuela_libro_grupo.sql` | Escuela_Libro | ALTER TABLE |
| `add_escuela_libro_pendiente.sql` | Escuela_Libro_Pendiente | CREATE TABLE |
| `add_glosario_segmento_cache.sql` | glosario, seccion_glosario | CREATE TABLE ×2 |
| `add_indexes.sql` | Persona, Alumno, Alumno_Libro, Licencia_Libro | CREATE INDEX |
| `add_libro_activo.sql` | Libro | ALTER TABLE |
| `add_libro_mensaje_error_job_id.sql` | Libro | ALTER TABLE |
| `add_libros_unidades_segmentos.sql` | Libro, Unidad, Segmento | CREATE TABLE / ALTER TABLE |
| `add_licencia_libro.sql` | Licencia_Libro | CREATE TABLE |
| `add_licencia_libro_archivada.sql` | Licencia_Libro_Archivada | CREATE TABLE |
| `add_maestro_grupo_table.sql` | Maestro_Grupo | CREATE TABLE |
| `add_persona_nombre_apellidos.sql` | Persona | ALTER TABLE |
| `add_pregunta_segmento.sql` | PreguntaSegmento | CREATE TABLE |
| `add_ruta_pdf_libro.sql` | Libro | ALTER TABLE |
| `add_ultima_conexion_persona.sql` | Persona | ALTER TABLE |
| `escuela_libro_unique.sql` | Escuela_Libro | CREATE UNIQUE INDEX |
| `make_libro_materia_optional.sql` | Libro | ALTER TABLE |
| `drop_apellido_column.sql` | Persona | ALTER TABLE (DROP COLUMN) |
| `drop_segundo_nombre.sql` | Persona | ALTER TABLE (DROP COLUMN) |

---

## Detalle por archivo

---

### `complete_database_setup.sql`

**Tablas:** Todas las tablas del sistema  
**Tipo:** Script maestro (CREATE TABLE + ALTER + FKs + Secuencias + Seed)

Script único para instalar toda la base de datos desde cero en un servidor vacío. Incluye la creación de todas las tablas principales (`Persona`, `Escuela`, `Alumno`, `Maestro`, `Director`, `Libro`, `Unidad`, `Segmento`, etc.), configuración de autenticación en `Persona`, secuencias autoincrement, todas las FKs, índices y el seed inicial de la materia `Lectura`.

**Dependencias:** Ninguna (es el punto de partida)  
**Notas:** Usar este script en instalaciones nuevas. Las migraciones individuales solo deben usarse para actualizar bases de datos ya existentes. Idempotente gracias a `IF NOT EXISTS` y `ON CONFLICT DO NOTHING`.

---

### `seed_lectura.sql`

**Tablas:** Materia  
**Tipo:** INSERT (seed)

Inserta la materia `Lectura` con `id=1` como dato inicial del sistema. Esta materia agrupa los libros de lectura general. También ajusta la secuencia de `Materia` para que los siguientes inserts usen ids mayores al máximo actual.

**Dependencias:** `complete_database_setup.sql`  
**Notas:** Usa `ON CONFLICT DO NOTHING` para ser idempotente. El ajuste de secuencia es condicional con `DO $$ ... $$`.

---

### `add_grupo_table.sql`

**Tablas:** Grupo  
**Tipo:** CREATE TABLE

Crea la tabla `Grupo` que representa los grupos escolares (ej. 1°A, 2°B) de una escuela. Solo el director puede crear y gestionar grupos de su propia escuela. Cada grupo tiene grado, nombre y estado activo/inactivo.

**Dependencias:** `Escuela`  
**Notas:** Índice único sobre `(escuela_id, grado, nombre)` para evitar grupos duplicados. Debe ejecutarse **antes** de `add_alumno_grupo_id.sql`.

---

### `add_alumno_grupo_id.sql`

**Tablas:** Alumno  
**Tipo:** ALTER TABLE

Agrega la columna `grupo_id` como llave foránea hacia la tabla `Grupo`. Establece la referencia canónica del grupo al que pertenece un alumno, complementando los campos legacy `grado` y `grupo` (varchar) que se mantienen por compatibilidad.

**Dependencias:** `add_grupo_table.sql` (debe ejecutarse antes)  
**Notas:** Incluye índice `IDX_ALUMNO_GRUPO` sobre `grupo_id` para optimizar joins y consultas por grupo.

---

### `backfill_alumno_grupo_id.sql`

**Tablas:** Alumno  
**Tipo:** UPDATE (backfill)

Script de relleno de datos: asigna el `grupo_id` correcto a los alumnos existentes que tienen `grado` y `grupo` (varchar) registrados pero aún no tienen `grupo_id`. Hace el join entre `Alumno` y `Grupo` por `escuela_id`, `grado` y nombre (case-insensitive).

**Dependencias:** `add_alumno_grupo_id.sql`, `add_grupo_table.sql` (ambos deben ejecutarse antes)  
**Notas:** Solo actualiza alumnos con `grupo_id IS NULL`. Usa `UPPER(TRIM())` para comparar nombres sin importar mayúsculas o espacios.

---

### `add_activo_alumno_maestro_director.sql`

**Tablas:** Alumno, Maestro, Director  
**Tipo:** ALTER TABLE

Agrega la columna `activo` (boolean, default `true`) a las tres tablas. Sirve para activar o desactivar usuarios en cascada cuando el administrador suspende una escuela, sin necesidad de eliminar los registros.

**Dependencias:** Ninguna  
**Notas:** Si una escuela se marca como inactiva o suspendida, el sistema debe actualizar estos campos en cascada vía lógica de negocio.

---

### `add_alumno_libro.sql`

**Tablas:** Alumno_Libro  
**Tipo:** CREATE TABLE

Registra la asignación de libros a alumnos y su progreso de lectura. Guarda porcentaje de avance, último segmento leído, fecha de asignación y quién asignó el libro (maestro o director). Un alumno solo puede ver los libros que le fueron asignados.

**Dependencias:** `Alumno`, `Libro`, `Segmento`  
**Notas:** Índice único sobre `(alumno_id, libro_id)` para evitar duplicados. FK con `Alumno` y `Libro` usa `ON DELETE CASCADE`; con `Segmento` usa `ON DELETE SET NULL`.

---

### `add_alumno_segmento_evaluacion.sql`

**Tablas:** Alumno_Segmento_Evaluacion  
**Tipo:** CREATE TABLE

Almacena los resultados de las evaluaciones por segmento. Guarda las preguntas y respuestas en formato JSONB, el puntaje obtenido, si el alumno aprobó, si puede avanzar al siguiente segmento y los apoyos recibidos en caso de dificultades.

**Dependencias:** `Alumno`, `Libro`, `Segmento`  
**Notas:** Soporta múltiples intentos por alumno/segmento (campo `intento`). Los campos `preguntas`, `respuestas` y `apoyos` son JSONB para flexibilidad con evaluaciones generadas por IA.

---

### `add_alumno_vinculacion_padre.sql`

**Tablas:** Alumno_Vinculacion_Padre  
**Tipo:** CREATE TABLE

Crea la tabla de códigos de vinculación entre padre/tutor y alumno. Genera códigos únicos de un solo uso que el padre utiliza para enlazar su cuenta con la del alumno. El código expira al ser usado o al llegar a su fecha de vencimiento.

**Dependencias:** `Alumno`  
**Notas:** El código es `VARCHAR(64)` único. Los campos `usado`, `usado_en` y `expira_en` controlan el ciclo de vida del código de invitación.

---

### `add_anotacion.sql`

**Tablas:** Anotacion  
**Tipo:** CREATE TABLE

Crea la tabla de anotaciones que el alumno puede hacer sobre el texto de un libro. Soporta dos tipos: `highlight` (resaltado) y `comentario`. Guarda la posición exacta del texto seleccionado mediante offsets de caracteres, el color del resaltado y el comentario opcional.

**Dependencias:** `Alumno`, `Libro`, `Segmento`  
**Notas:** CHECK constraint valida que el tipo solo sea `'highlight'` o `'comentario'`. Índices compuestos sobre `(alumno_id, libro_id)` y `segmento_id`.

---

### `add_audit_log.sql`

**Tablas:** audit_log  
**Tipo:** CREATE TABLE

Crea la tabla de auditoría del sistema. Registra acciones sensibles como inicios de sesión, cambios de permisos y asignaciones de libros. Solo visible para administradores. Guarda la acción, el usuario que la ejecutó, la IP de origen y detalles adicionales.

**Dependencias:** Ninguna  
**Notas:** Índices sobre `fecha (DESC)`, `accion` y `usuario_id`. También incluida en `complete_database_setup.sql`.

---

### `add_director_table.sql`

**Tablas:** Director  
**Tipo:** CREATE TABLE

Crea la tabla `Director` con su secuencia autoincremental y las FKs hacia `Persona` y `Escuela`. Un director pertenece a una escuela y tiene fecha de nombramiento. Usa una función auxiliar `setup_sequence` para configurar la secuencia de forma dinámica.

**Dependencias:** `Persona`, `Escuela` (`complete_database_setup.sql` debe ejecutarse antes)  
**Notas:** La función `setup_sequence` se elimina al final del script (`DROP FUNCTION`). La tabla también está incluida en `complete_database_setup.sql`.

---

### `add_editorial_libro.sql`

**Tablas:** Libro  
**Tipo:** ALTER TABLE

Agrega las columnas `editorial` (varchar 150) y `autor` (varchar 150) a la tabla `Libro`. Permite registrar información bibliográfica del libro para mostrar en la interfaz y en reportes.

**Dependencias:** `Libro`  
**Notas:** Ambas columnas son nullable para mantener compatibilidad con libros ya existentes.

---

### `add_escuela_estado_ciudad_region.sql`

**Tablas:** Escuela  
**Tipo:** ALTER TABLE

Agrega tres columnas a `Escuela`: `estado` (activa/inactiva/suspendida, default `'activa'`), `ciudad` (varchar 100) y `estado_region` (entidad federativa, varchar 100). Permite filtrar escuelas por ubicación geográfica y estado en el panel de administración.

**Dependencias:** `Escuela`  
**Notas:** La columna `estado` no debe confundirse con el estado geográfico; para eso existe `estado_region`.

---

### `add_escuela_libro_grupo.sql`

**Tablas:** Escuela_Libro  
**Tipo:** ALTER TABLE

Agrega la columna `grupo` (varchar 10, nullable) a `Escuela_Libro`. Cuando es `NULL`, el libro está disponible para todos los grupos del grado. Cuando tiene valor (ej. `'A'`), solo los alumnos de ese grupo específico pueden ver el libro.

**Dependencias:** `Escuela_Libro`  
**Notas:** Permite segmentación de libros por grupo dentro de un mismo grado y escuela.

---

### `add_escuela_libro_pendiente.sql`

**Tablas:** Escuela_Libro_Pendiente  
**Tipo:** CREATE TABLE

Tabla intermedia para el flujo de doble verificación en la asignación de libros. El administrador otorga un libro a una escuela dejándolo pendiente aquí. El director debe canjear un código para que el libro pase a `Escuela_Libro` y quede activo.

**Dependencias:** `Escuela`, `Libro`  
**Notas:** Índice único sobre `(escuela_id, libro_id)`. También incluida en `complete_database_setup.sql`.

---

### `add_glosario_segmento_cache.sql`

**Tablas:** glosario, seccion_glosario  
**Tipo:** CREATE TABLE ×2

Crea dos tablas: `glosario` como diccionario global de palabras con definiciones, y `seccion_glosario` como caché de términos por segmento específico. Permite mostrar definiciones inline mientras el alumno lee sin consultar el glosario global cada vez.

**Dependencias:** `Segmento`  
**Notas:** Unique constraint en `glosario.palabra` y en `(segmento_id, palabra)` de `seccion_glosario` para evitar duplicados.

---

### `add_indexes.sql`

**Tablas:** Persona, Alumno, Alumno_Libro, Licencia_Libro  
**Tipo:** CREATE INDEX

Agrega índices de rendimiento sobre columnas de consulta frecuente: `correo` en `Persona`, `escuela_id` en `Alumno`, `(alumno_id, libro_id)` en `Alumno_Libro` y `clave` en `Licencia_Libro`. Optimiza búsquedas de login, listados por escuela y validación de licencias.

**Dependencias:** `Persona`, `Alumno`, `Alumno_Libro`, `Licencia_Libro`  
**Notas:** Todos los índices usan `IF NOT EXISTS` para ser idempotentes.

---

### `add_libro_activo.sql`

**Tablas:** Libro  
**Tipo:** ALTER TABLE

Agrega la columna `activo` (boolean, default `true`) a `Libro`. Permite desactivar un libro globalmente: si es `false`, el libro no aparece en ninguna escuela ni puede ser otorgado, independientemente de `Escuela_Libro.activo`.

**Dependencias:** `Libro`  
**Notas:** Desactivación global (`Libro.activo`) vs. desactivación por escuela (`Escuela_Libro.activo`). Ambas pueden coexistir.

---

### `add_libro_mensaje_error_job_id.sql`

**Tablas:** Libro  
**Tipo:** ALTER TABLE

Agrega los campos `mensaje_error` (varchar 512) y `job_id` (varchar 100) para soporte del pipeline asíncrono de procesamiento de libros. Cuando el estado del libro es `'error'`, `mensaje_error` contiene la descripción del fallo. `job_id` guarda el identificador del job en BullMQ.

**Dependencias:** `Libro`  
**Notas:** Relacionado con el sistema de colas BullMQ para procesamiento asíncrono de PDFs.

---

### `add_libros_unidades_segmentos.sql`

**Tablas:** Libro, Unidad, Segmento  
**Tipo:** CREATE TABLE / ALTER TABLE

Extiende `Libro` con campos `estado` y `num_paginas`, y crea las tablas `Unidad` y `Segmento`. `Unidad` agrupa pedagógicamente los segmentos de un libro. `Segmento` es la unidad mínima de lectura (~100-200 palabras), con contenido de texto, número de página e `id_externo` único.

**Dependencias:** `Libro`  
**Notas:** `id_externo` en `Segmento` tiene índice único para identificación desde el procesador externo de PDFs. Las FKs usan `ON DELETE CASCADE`.

---

### `add_licencia_libro.sql`

**Tablas:** Licencia_Libro  
**Tipo:** CREATE TABLE

Sistema de licencias individuales: 1 licencia = 1 alumno. Cada licencia tiene clave única, fecha de vencimiento, escuela asignada y alumno opcional (`NULL` = sin asignar). Cuando el alumno canjea la licencia, se registra la fecha de asignación.

**Dependencias:** `Libro`, `Escuela`, `Alumno`  
**Notas:** Índice único sobre `clave`. FK hacia `Alumno` usa `ON DELETE SET NULL` para conservar la licencia aunque el alumno sea eliminado.

---

### `add_licencia_libro_archivada.sql`

**Tablas:** Licencia_Libro_Archivada  
**Tipo:** CREATE TABLE

Tabla histórica de licencias vencidas o revocadas. Cuando una licencia de `Licencia_Libro` expira, se archiva aquí con su motivo. Permite auditar el historial de acceso de alumnos a libros sin afectar la tabla activa.

**Dependencias:** Ninguna (snapshot, sin FKs activas)  
**Notas:** Sin FKs para preservar el histórico incluso si el alumno o libro son eliminados. Índices sobre `escuela_id`, `libro_id`, `alumno_id` y `fecha_vencimiento`.

---

### `add_maestro_grupo_table.sql`

**Tablas:** Maestro_Grupo  
**Tipo:** CREATE TABLE

Tabla de relación muchos a muchos entre `Maestro` y `Grupo`. El director asigna grupos a maestros. Un maestro puede tener varios grupos y un grupo puede tener varios maestros (de distintas materias).

**Dependencias:** `Maestro`, `Grupo`  
**Notas:** Índice único sobre `(maestro_id, grupo_id)` para evitar asignaciones duplicadas.

---

### `add_persona_nombre_apellidos.sql`

**Tablas:** Persona  
**Tipo:** ALTER TABLE

Separa los apellidos en dos campos: `apellido_paterno` y `apellido_materno`, además de agregar `segundo_nombre`. Migra los datos existentes del campo `apellido` hacia `apellido_paterno`. El campo `apellido` queda nullable por compatibilidad.

**Dependencias:** `Persona`  
**Notas:** Incluye migración de datos. Ejecutar **antes** de `drop_apellido_column.sql`.

---

### `add_pregunta_segmento.sql`

**Tablas:** PreguntaSegmento  
**Tipo:** CREATE TABLE

Tabla de preguntas por segmento generadas por IA. Cada segmento tiene preguntas en tres niveles: básico, intermedio y avanzado. Las preguntas se generan al cargar el libro y se usan en las evaluaciones de comprensión lectora.

**Dependencias:** `Segmento`  
**Notas:** Índices sobre `(segmento_id)` y `(segmento_id, nivel)` para filtrar preguntas por dificultad. FK con `ON DELETE CASCADE`.

---

### `add_ruta_pdf_libro.sql`

**Tablas:** Libro  
**Tipo:** ALTER TABLE

Agrega la columna `ruta_pdf` (varchar 512) a `Libro` para almacenar la ruta relativa del archivo PDF en disco (carpeta `pdfs/`). Permite al backend localizar y servir el PDF original del libro.

**Dependencias:** `Libro`  
**Notas:** También incluida en `complete_database_setup.sql`. La ruta es relativa al directorio de almacenamiento del servidor.

---

### `add_ultima_conexion_persona.sql`

**Tablas:** Persona  
**Tipo:** ALTER TABLE

Agrega el campo `ultima_conexion` (timestamptz) a `Persona`. Se actualiza en cada inicio de sesión exitoso. Permite al administrador ver cuándo fue el último acceso de cada usuario.

**Dependencias:** `Persona`  
**Notas:** Default `NULL` para usuarios que nunca han iniciado sesión.

---

### `escuela_libro_unique.sql`

**Tablas:** Escuela_Libro  
**Tipo:** CREATE UNIQUE INDEX

Agrega un índice único sobre `(escuela_id, libro_id)` en `Escuela_Libro` para evitar que el mismo libro sea asignado dos veces a la misma escuela. Garantiza integridad a nivel de base de datos.

**Dependencias:** `Escuela_Libro`  
**Notas:** También incluido en `complete_database_setup.sql`. Idempotente con `IF NOT EXISTS`.

---

### `make_libro_materia_optional.sql`

**Tablas:** Libro  
**Tipo:** ALTER TABLE

Hace opcional la columna `materia_id` en `Libro` (`DROP NOT NULL`). Permite registrar libros de lectura libre que no pertenecen a una materia curricular específica.

**Dependencias:** `Libro`  
**Notas:** También incluido en `complete_database_setup.sql`.

---

### `drop_apellido_column.sql` ⚠️

**Tablas:** Persona  
**Tipo:** ALTER TABLE (DROP COLUMN)

Elimina la columna `apellido` de `Persona` después de haber migrado los datos a `apellido_paterno` y `apellido_materno`. Es el paso final de la migración de nombres.

**Dependencias:** `add_persona_nombre_apellidos.sql` (debe ejecutarse antes)  
**Notas:** ⚠️ Acción destructiva e irreversible. Verificar que todos los datos estén migrados y que ningún módulo del backend use esta columna antes de ejecutar.

---

### `drop_segundo_nombre.sql` ⚠️

**Tablas:** Persona  
**Tipo:** ALTER TABLE (DROP COLUMN)

Elimina la columna `segundo_nombre` de `Persona`. Se decidió manejar el nombre como un solo campo unificado en lugar de separarlo en primero y segundo nombre.

**Dependencias:** `add_persona_nombre_apellidos.sql`  
**Notas:** ⚠️ Acción destructiva. Confirmar que ningún módulo del backend use esta columna antes de ejecutar.