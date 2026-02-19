-- Libro activo global: si es false, no se ve en ninguna escuela ni se puede otorgar.
-- Ejecutar en tu base de datos.

ALTER TABLE "Libro"
  ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;
