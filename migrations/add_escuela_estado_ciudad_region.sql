-- Añadir columnas estado, ciudad, estado_region a Escuela para gestión y filtros del panel.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_escuela_estado_ciudad_region.sql

ALTER TABLE "Escuela"
  ADD COLUMN IF NOT EXISTS "estado" varchar(20) DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS "ciudad" varchar(100),
  ADD COLUMN IF NOT EXISTS "estado_region" varchar(100);

-- Opcional: marcar escuelas existentes como activas si la columna ya existía sin default
-- UPDATE "Escuela" SET "estado" = 'activa' WHERE "estado" IS NULL;
