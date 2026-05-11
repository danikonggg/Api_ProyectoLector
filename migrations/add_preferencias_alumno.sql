-- ============================================
-- MIGRACIÓN: Preferencias_Alumno
-- ============================================
-- Preferencias de UI por alumno (ej. ocultar tutorial lector)
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_preferencias_alumno.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Preferencias_Alumno" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "alumno_id" bigint NOT NULL UNIQUE,
  "ocultar_tutorial_lector" boolean NOT NULL DEFAULT false,
  "tema_lector" varchar(10) NOT NULL DEFAULT 'sepia',
  "idioma" varchar(5) NOT NULL DEFAULT 'es',
  "actualizado_en" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_preferencias_alumno_alumno" ON "Preferencias_Alumno" ("alumno_id");

ALTER TABLE "Preferencias_Alumno"
  ADD CONSTRAINT "Preferencias_Alumno_fk_alumno"
  FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id") ON DELETE CASCADE;

ALTER TABLE "Preferencias_Alumno"
  ADD CONSTRAINT "Preferencias_Alumno_tema_chk"
  CHECK ("tema_lector" IN ('sepia','oscuro','claro'));

COMMENT ON TABLE "Preferencias_Alumno" IS 'Preferencias de UI por alumno. 1 fila por alumno.';
