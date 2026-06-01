-- Migración: correo único en Persona y unique compuesto en AlumnoLibro
-- Ejecutar una sola vez en producción

-- 1. Eliminar correos duplicados antes de agregar el unique
--    (conserva el registro con id más pequeño por correo)
DELETE FROM "Persona"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "Persona"
  WHERE correo IS NOT NULL
  GROUP BY correo
);

-- 2. Agregar índice único en correo de Persona (permite NULL múltiples)
CREATE UNIQUE INDEX IF NOT EXISTS "Persona_correo_key"
  ON "Persona" (correo)
  WHERE correo IS NOT NULL;

-- 3. Eliminar asignaciones duplicadas en AlumnoLibro
--    (conserva el registro con id más pequeño por par alumno-libro)
DELETE FROM "Alumno_Libro"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "Alumno_Libro"
  GROUP BY alumno_id, libro_id
);

-- 4. Agregar unique compuesto en AlumnoLibro
ALTER TABLE "Alumno_Libro"
  ADD CONSTRAINT "Alumno_Libro_alumnoId_libroId_key"
  UNIQUE (alumno_id, libro_id);
