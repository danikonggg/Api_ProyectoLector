-- Campo activo en Alumno, Maestro y Director.
-- Cuando el admin pone la escuela en inactiva/suspendida, se desactivan en cascada.
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_activo_alumno_maestro_director.sql

ALTER TABLE "Alumno"
  ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;

ALTER TABLE "Maestro"
  ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;

ALTER TABLE "Director"
  ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;
