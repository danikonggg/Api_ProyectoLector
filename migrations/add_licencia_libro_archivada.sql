-- ============================================
-- MIGRACIÓN: Licencia_Libro_Archivada
-- ============================================
-- Tabla para guardar un histórico cuando una licencia expira.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_licencia_libro_archivada.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Licencia_Libro_Archivada" (
  "id" BIGSERIAL PRIMARY KEY,
  "licencia_id" bigint NOT NULL,
  "clave" varchar(50) NOT NULL,
  "libro_id" bigint NOT NULL,
  "escuela_id" bigint NOT NULL,
  "alumno_id" bigint,
  "fecha_vencimiento" date NOT NULL,
  "activa" boolean NOT NULL,
  "fecha_asignacion" timestamptz,
  "archivada_en" timestamptz NOT NULL DEFAULT NOW(),
  "motivo" varchar(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_licencia_libro_archivada_escuela" ON "Licencia_Libro_Archivada" ("escuela_id");
CREATE INDEX IF NOT EXISTS "idx_licencia_libro_archivada_libro" ON "Licencia_Libro_Archivada" ("libro_id");
CREATE INDEX IF NOT EXISTS "idx_licencia_libro_archivada_alumno" ON "Licencia_Libro_Archivada" ("alumno_id");
CREATE INDEX IF NOT EXISTS "idx_licencia_libro_archivada_fecha" ON "Licencia_Libro_Archivada" ("fecha_vencimiento");

COMMENT ON TABLE "Licencia_Libro_Archivada" IS 'Histórico de licencias vencidas.';

