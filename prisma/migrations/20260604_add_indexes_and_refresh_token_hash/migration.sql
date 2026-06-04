-- Migration: add_indexes_and_refresh_token_hash
-- Generated: 2026-06-04

-- ============================================
-- 1. Refresh token revocation field
-- ============================================
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "refresh_token_hash" VARCHAR(255);

-- ============================================
-- 2. Performance indexes — Persona
-- ============================================
CREATE INDEX IF NOT EXISTS "Persona_correo_idx"      ON "Persona"("correo");
CREATE INDEX IF NOT EXISTS "Persona_tipo_persona_idx" ON "Persona"("tipo_persona");
CREATE INDEX IF NOT EXISTS "Persona_activo_idx"       ON "Persona"("activo");

-- ============================================
-- 3. Performance indexes — Alumno
-- ============================================
CREATE INDEX IF NOT EXISTS "Alumno_escuela_id_idx" ON "Alumno"("escuela_id");
CREATE INDEX IF NOT EXISTS "Alumno_padre_id_idx"   ON "Alumno"("padre_id");
CREATE INDEX IF NOT EXISTS "Alumno_activo_idx"     ON "Alumno"("activo");

-- ============================================
-- 4. Performance indexes — Maestro
-- ============================================
CREATE INDEX IF NOT EXISTS "Maestro_escuela_id_idx" ON "Maestro"("escuela_id");
CREATE INDEX IF NOT EXISTS "Maestro_activo_idx"     ON "Maestro"("activo");

-- ============================================
-- 5. Performance indexes — Director
-- ============================================
CREATE INDEX IF NOT EXISTS "Director_escuela_id_idx" ON "Director"("escuela_id");
CREATE INDEX IF NOT EXISTS "Director_activo_idx"     ON "Director"("activo");

-- ============================================
-- 6. Performance indexes — Alumno_Libro
-- ============================================
-- Unique constraint: un alumno no puede tener el mismo libro dos veces
ALTER TABLE "Alumno_Libro"
  ADD CONSTRAINT "Alumno_Libro_alumno_id_libro_id_key"
  UNIQUE ("alumno_id", "libro_id")
  DEFERRABLE INITIALLY DEFERRED;  -- deferrable for bulk operations

CREATE INDEX IF NOT EXISTS "Alumno_Libro_libro_id_idx" ON "Alumno_Libro"("libro_id");

-- ============================================
-- 7. Performance indexes — Alumno_Segmento_Evaluacion
-- ============================================
CREATE INDEX IF NOT EXISTS "AlumnoSegEval_alumno_libro_idx"
  ON "Alumno_Segmento_Evaluacion"("alumno_id", "libro_id");

CREATE INDEX IF NOT EXISTS "AlumnoSegEval_alumno_segmento_idx"
  ON "Alumno_Segmento_Evaluacion"("alumno_id", "segmento_id");
