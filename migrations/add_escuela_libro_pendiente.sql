-- ============================================
-- MIGRACIÓN: Tabla Escuela_Libro_Pendiente
-- ============================================
-- Doble verificación: el admin otorga el libro a la escuela;
-- la escuela debe canjear el código para que el libro se active.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_escuela_libro_pendiente.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "Escuela_Libro_Pendiente" (
  "id" BIGSERIAL PRIMARY KEY,
  "escuela_id" BIGINT NOT NULL REFERENCES "Escuela"("id") ON DELETE CASCADE,
  "libro_id" BIGINT NOT NULL REFERENCES "Libro"("id") ON DELETE CASCADE,
  "fecha_otorgado" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_escuela_libro_pendiente_uniq"
  ON "Escuela_Libro_Pendiente" ("escuela_id", "libro_id");

COMMENT ON TABLE "Escuela_Libro_Pendiente" IS 'Libros otorgados por admin a una escuela, pendientes de canje por la escuela';
