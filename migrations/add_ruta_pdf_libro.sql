-- ============================================
-- MIGRACIÓN: ruta_pdf en Libro
-- ============================================
-- Guarda la ruta relativa del PDF almacenado en disco (carpeta pdfs/).
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_ruta_pdf_libro.sql
-- ============================================

ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "ruta_pdf" varchar(512);
