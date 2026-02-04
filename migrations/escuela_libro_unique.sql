-- ============================================
-- MIGRACIÓN: Unique escuela_id + libro_id en Escuela_Libro
-- ============================================
-- Evita asignar el mismo libro dos veces a la misma escuela.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/escuela_libro_unique.sql
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "idx_escuela_libro_uniq"
  ON "Escuela_Libro" ("escuela_id", "libro_id");
