-- Campo ultima_conexion en Persona: guarda el último login exitoso.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_ultima_conexion_persona.sql

ALTER TABLE "Persona"
  ADD COLUMN IF NOT EXISTS "ultima_conexion" timestamptz DEFAULT NULL;

COMMENT ON COLUMN "Persona"."ultima_conexion" IS 'Última vez que el usuario inició sesión correctamente';
