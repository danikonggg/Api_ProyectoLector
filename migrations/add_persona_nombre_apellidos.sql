-- ============================================
-- Migración: Separar nombre y apellidos en Persona
-- ============================================
-- Campos: nombre (primer nombre), segundo_nombre, apellido_paterno, apellido_materno
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_persona_nombre_apellidos.sql
-- ============================================

-- Agregar nuevas columnas
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "segundo_nombre" varchar(100);
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "apellido_paterno" varchar(100);
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "apellido_materno" varchar(100);

-- Migrar datos existentes: apellido -> apellido_paterno (apellido_materno queda vacío)
UPDATE "Persona"
SET "apellido_paterno" = COALESCE("apellido", ''),
    "apellido_materno" = COALESCE("apellido_materno", '');

-- Hacer apellido_paterno NOT NULL para nuevas inserciones (ya tiene valores)
ALTER TABLE "Persona" ALTER COLUMN "apellido_paterno" SET NOT NULL;

-- Hacer apellido nullable para no obligar a rellenarlo en nuevos registros
ALTER TABLE "Persona" ALTER COLUMN "apellido" DROP NOT NULL;

-- La columna "apellido" se mantiene por compatibilidad; el código usará apellido_paterno y apellido_materno
