-- ============================================
-- Libros de lectura sin materia (testing)
-- ============================================
-- Hace materia_id opcional en Libro.
-- ============================================

ALTER TABLE "Libro" ALTER COLUMN "materia_id" DROP NOT NULL;
