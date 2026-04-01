-- ============================================
-- MIGRACIÓN: Anotacion
-- ============================================
-- Anotaciones del alumno por libro/segmento (highlight o comentario)
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_anotacion.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Anotacion" (
  "id" BIGSERIAL PRIMARY KEY,
  "alumno_id" bigint NOT NULL,
  "libro_id" bigint NOT NULL,
  "segmento_id" bigint NOT NULL,
  "tipo" varchar(20) NOT NULL,
  "texto_seleccionado" text NOT NULL,
  "offset_inicio" int NOT NULL,
  "offset_fin" int NOT NULL,
  "color" varchar(20),
  "comentario" text,
  "creado_en" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_anotacion_alumno_libro" ON "Anotacion" ("alumno_id", "libro_id");
CREATE INDEX IF NOT EXISTS "idx_anotacion_segmento" ON "Anotacion" ("segmento_id");

ALTER TABLE "Anotacion"
  ADD CONSTRAINT "Anotacion_fk_alumno"
  FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id") ON DELETE CASCADE;

ALTER TABLE "Anotacion"
  ADD CONSTRAINT "Anotacion_fk_libro"
  FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Anotacion"
  ADD CONSTRAINT "Anotacion_fk_segmento"
  FOREIGN KEY ("segmento_id") REFERENCES "Segmento"("id") ON DELETE CASCADE;

ALTER TABLE "Anotacion"
  ADD CONSTRAINT "Anotacion_tipo_chk"
  CHECK ("tipo" IN ('highlight', 'comentario'));

COMMENT ON TABLE "Anotacion" IS 'Anotaciones del alumno sobre segmentos de libro.';
