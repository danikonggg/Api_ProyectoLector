-- ============================================
-- BACKFILL: Asignar grupo_id a alumnos existentes
-- ============================================
-- Asigna grupo_id a alumnos que tienen grado y grupo pero grupo_id = null.
-- Busca el Grupo correspondiente por (escuela_id, grado, UPPER(TRIM(nombre))).
-- Ejecutar DESPUÉS de add_alumno_grupo_id.sql
-- Ejecutar: psql -U postgres -d api_lector -f migrations/backfill_alumno_grupo_id.sql
-- ============================================

UPDATE "Alumno" a
SET grupo_id = g.id
FROM "Grupo" g
WHERE a.escuela_id = g.escuela_id
  AND a.grado = g.grado
  AND UPPER(TRIM(COALESCE(a.grupo, ''))) = UPPER(TRIM(g.nombre))
  AND (a.grupo_id IS NULL)
  AND g.activo = true;
