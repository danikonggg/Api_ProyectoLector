-- Añade campos para pipeline asíncrono y errores
-- Ejecutar: psql -U postgres -d api_lector -f migrations/add_libro_mensaje_error_job_id.sql

ALTER TABLE "Libro"
ADD COLUMN IF NOT EXISTS mensaje_error VARCHAR(512),
ADD COLUMN IF NOT EXISTS job_id VARCHAR(100);

COMMENT ON COLUMN "Libro".mensaje_error IS 'Mensaje de error cuando estado=error';
COMMENT ON COLUMN "Libro".job_id IS 'ID del job BullMQ para procesamiento asíncrono';
