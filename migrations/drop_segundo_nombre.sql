-- ============================================
-- Migración: Eliminar columna segundo_nombre de Persona
-- ============================================
-- El nombre se usa como campo único (no separado en primero/segundo).
-- Ejecutar: psql -U postgres -d api_lector -f migrations/drop_segundo_nombre.sql
-- ============================================

ALTER TABLE "Persona" DROP COLUMN IF EXISTS "segundo_nombre";
