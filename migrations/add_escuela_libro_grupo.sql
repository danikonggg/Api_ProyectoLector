-- ============================================
-- MIGRACIÓN: Grupo en Escuela_Libro
-- ============================================
-- grupo (varchar, nullable): cuando es null = libro para todos los grupos del grado.
-- Cuando tiene valor (ej. "A") = solo alumnos con alumno.grupo = ese valor ven el libro.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_escuela_libro_grupo.sql
-- ============================================

ALTER TABLE "Escuela_Libro" ADD COLUMN IF NOT EXISTS "grupo" varchar(10);
