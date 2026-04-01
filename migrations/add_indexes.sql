-- Índices para optimizar consultas frecuentes
-- Ejecutar manualmente: psql -d ProyectoLector -f migrations/add_indexes.sql

CREATE INDEX IF NOT EXISTS idx_persona_correo ON "Persona"(correo);
CREATE INDEX IF NOT EXISTS idx_alumno_escuela ON "Alumno"(escuela_id);
CREATE INDEX IF NOT EXISTS idx_alumno_libro_ids ON "Alumno_Libro"(alumno_id, libro_id);
CREATE INDEX IF NOT EXISTS idx_licencia_clave ON "Licencia_Libro"(clave);
