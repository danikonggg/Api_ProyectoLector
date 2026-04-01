-- ============================================
-- MIGRACIÓN: Licencia_Libro
-- ============================================
-- Licencias individuales por libro: 1 licencia = 1 alumno.
-- Clave única, vencimiento, asociada a escuela, un solo uso.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_licencia_libro.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Licencia_Libro" (
  "id" bigint NOT NULL,
  "clave" varchar(50) NOT NULL,
  "libro_id" bigint NOT NULL,
  "escuela_id" bigint NOT NULL,
  "alumno_id" bigint,
  "fecha_vencimiento" date NOT NULL,
  "activa" boolean NOT NULL DEFAULT true,
  "fecha_asignacion" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_licencia_libro_clave_uniq" ON "Licencia_Libro" ("clave");
CREATE INDEX IF NOT EXISTS "idx_licencia_libro_escuela_libro" ON "Licencia_Libro" ("escuela_id", "libro_id", "activa");
CREATE INDEX IF NOT EXISTS "idx_licencia_libro_alumno" ON "Licencia_Libro" ("alumno_id");

-- FKs
ALTER TABLE "Licencia_Libro"
  ADD CONSTRAINT "Licencia_Libro_fk_libro" FOREIGN KEY ("libro_id")
  REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Licencia_Libro"
  ADD CONSTRAINT "Licencia_Libro_fk_escuela" FOREIGN KEY ("escuela_id")
  REFERENCES "Escuela"("id") ON DELETE CASCADE;

ALTER TABLE "Licencia_Libro"
  ADD CONSTRAINT "Licencia_Libro_fk_alumno" FOREIGN KEY ("alumno_id")
  REFERENCES "Alumno"("id") ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS "Licencia_Libro_id_seq";
ALTER TABLE "Licencia_Libro" ALTER COLUMN "id" SET DEFAULT nextval('"Licencia_Libro_id_seq"');
ALTER SEQUENCE "Licencia_Libro_id_seq" OWNED BY "Licencia_Libro"."id";

COMMENT ON TABLE "Licencia_Libro" IS 'Licencias individuales por libro: 1 licencia = 1 alumno. Clave única, vencimiento, escuela, un solo uso.';
