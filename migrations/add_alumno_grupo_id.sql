-- ============================================
-- MIGRACIÓN: grupo_id en Alumno
-- ============================================
-- FK a Grupo para integridad referencial.
-- Mantenemos grado y grupo por compatibilidad; grupo_id es la referencia canónica.
-- Ejecutar DESPUÉS de add_grupo_table.sql
-- ============================================

ALTER TABLE "Alumno" ADD COLUMN IF NOT EXISTS "grupo_id" bigint REFERENCES "Grupo"("id");
CREATE INDEX IF NOT EXISTS "IDX_ALUMNO_GRUPO" ON "Alumno" ("grupo_id");
