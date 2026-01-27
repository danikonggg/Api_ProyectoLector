-- ============================================
-- SEED: Materia "Lectura" (libros de lectura)
-- ============================================
-- Ejecutar después de complete_database_setup y, si usas libros,
-- de add_libros_unidades_segmentos y make_libro_materia_optional.
--
-- Uso: psql -U postgres -d api_lector -f migrations/seed_lectura.sql
-- ============================================

-- Materia para libros de lectura (opcional; por ahora solo lectura sin materia)
INSERT INTO "Materia" ("id", "nombre", "descripcion", "nivel")
VALUES (1, 'Lectura', 'Libros de lectura', 'General')
ON CONFLICT ("id") DO NOTHING;

-- Ajustar secuencia para que los próximos INSERT usen id > max(id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'Materia_id_seq') THEN
    PERFORM setval('"Materia_id_seq"', (SELECT COALESCE(MAX("id"), 1) FROM "Materia"));
  END IF;
END $$;
