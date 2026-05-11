-- ============================================
-- MIGRACIÓN: Sesion_Lectura
-- ============================================
-- Sesiones de lectura del alumno por libro (duración real y segmentos leídos)
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_sesion_lectura.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Sesion_Lectura" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "alumno_id" bigint NOT NULL,
  "libro_id" bigint NOT NULL,
  "duracion_segundos" int NOT NULL,
  "segmentos_leidos" int NOT NULL DEFAULT 0,
  "segmento_inicio_id" bigint,
  "segmento_fin_id" bigint,
  "fecha_inicio" timestamptz NOT NULL,
  "fecha_fin" timestamptz NOT NULL,
  "creado_en" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_sesion_lectura_alumno" ON "Sesion_Lectura" ("alumno_id");
CREATE INDEX IF NOT EXISTS "idx_sesion_lectura_alumno_libro" ON "Sesion_Lectura" ("alumno_id", "libro_id");
CREATE INDEX IF NOT EXISTS "idx_sesion_lectura_fecha_fin" ON "Sesion_Lectura" ("fecha_fin" DESC);

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_fk_alumno"
  FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id") ON DELETE CASCADE;

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_fk_libro"
  FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_fk_segmento_inicio"
  FOREIGN KEY ("segmento_inicio_id") REFERENCES "Segmento"("id") ON DELETE SET NULL;

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_fk_segmento_fin"
  FOREIGN KEY ("segmento_fin_id") REFERENCES "Segmento"("id") ON DELETE SET NULL;

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_duracion_chk"
  CHECK ("duracion_segundos" >= 0);

ALTER TABLE "Sesion_Lectura"
  ADD CONSTRAINT "Sesion_Lectura_segmentos_leidos_chk"
  CHECK ("segmentos_leidos" >= 0);

COMMENT ON TABLE "Sesion_Lectura" IS 'Sesiones de lectura del alumno por libro.';
