-- ============================================
-- Migración: Eliminar columna apellido de Persona
-- ============================================
-- Los apellidos se manejan con apellido_paterno y apellido_materno.
-- Ejecutar después de haber migrado los datos (add_persona_nombre_apellidos.sql).
-- Ejecutar: psql -U postgres -d api_lector -f migrations/drop_apellido_column.sql
-- ============================================

ALTER TABLE "Persona" DROP COLUMN IF EXISTS "apellido";
