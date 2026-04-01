-- ============================================
-- MIGRACIÓN: Agregar columnas editorial y autor a Libro
-- ============================================

ALTER TABLE "Libro"
  ADD COLUMN IF NOT EXISTS "editorial" varchar(150),
  ADD COLUMN IF NOT EXISTS "autor" varchar(150);

