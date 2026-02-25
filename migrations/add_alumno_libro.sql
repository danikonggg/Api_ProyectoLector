-- ============================================
-- MIGRACIÓN: Alumno_Libro
-- ============================================
-- Asignación libro por alumno + progreso de lectura.
-- Maestro/Director asigna; el alumno solo ve libros asignados.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_alumno_libro.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Alumno_Libro" (
  "id" bigint NOT NULL,
  "alumno_id" bigint NOT NULL,
  "libro_id" bigint NOT NULL,
  "porcentaje" integer NOT NULL DEFAULT 0,
  "ultimo_segmento_id" bigint,
  "ultima_lectura" timestamptz,
  "fecha_asignacion" date NOT NULL DEFAULT CURRENT_DATE,
  "asignado_por_tipo" varchar(20) DEFAULT 'maestro',
  "asignado_por_id" bigint,
  PRIMARY KEY ("id")
);

CREATE SEQUENCE IF NOT EXISTS "Alumno_Libro_id_seq";
ALTER TABLE "Alumno_Libro" ALTER COLUMN "id" SET DEFAULT nextval('"Alumno_Libro_id_seq"');
ALTER SEQUENCE "Alumno_Libro_id_seq" OWNED BY "Alumno_Libro"."id";

-- Unique: un alumno no puede tener el mismo libro asignado dos veces
CREATE UNIQUE INDEX IF NOT EXISTS "idx_alumno_libro_uniq"
  ON "Alumno_Libro" ("alumno_id", "libro_id");

-- FKs
ALTER TABLE "Alumno_Libro"
  ADD CONSTRAINT "Alumno_Libro_fk_alumno" FOREIGN KEY ("alumno_id")
  REFERENCES "Alumno"("id") ON DELETE CASCADE;

ALTER TABLE "Alumno_Libro"
  ADD CONSTRAINT "Alumno_Libro_fk_libro" FOREIGN KEY ("libro_id")
  REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Alumno_Libro"
  ADD CONSTRAINT "Alumno_Libro_fk_segmento" FOREIGN KEY ("ultimo_segmento_id")
  REFERENCES "Segmento"("id") ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS "idx_alumno_libro_alumno" ON "Alumno_Libro"("alumno_id");
CREATE INDEX IF NOT EXISTS "idx_alumno_libro_libro" ON "Alumno_Libro"("libro_id");
