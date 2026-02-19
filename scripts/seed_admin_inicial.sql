-- ============================================
-- SEED: Admin inicial para BD nueva
-- ============================================
-- Crea 1 admin: admin@proyectolector.com / 123456
-- Es idempotente: no crea duplicados si ya existe.
--
-- Uso (local):
--   psql -U postgres -d ProyectoLector -f scripts/seed_admin_inicial.sql
--
-- Uso (Supabase): pegar en SQL Editor y ejecutar
-- ============================================

DO $$
DECLARE
  v_persona_id bigint;
BEGIN
  -- Solo si no existe ya un admin con ese correo
  IF NOT EXISTS (
    SELECT 1 FROM public."Admin" a
    INNER JOIN public."Persona" p ON p.id = a.persona_id
    WHERE p.correo = 'admin@proyectolector.com'
  ) THEN
    -- Insertar persona
    INSERT INTO public."Persona" (nombre, apellido, correo, telefono, fecha_nacimiento, genero, password, tipo_persona, activo)
    VALUES (
      'Admin',
      'Inicial',
      'admin@proyectolector.com',
      NULL,
      NULL,
      NULL,
      '$2b$10$yaF9zG18z5ctuCbtkIJbaeHP.wuc8VEI4n1KVbqKK6fjnSFjIcc4W',
      'administrador',
      true
    )
    RETURNING id INTO v_persona_id;

    -- Insertar Admin
    INSERT INTO public."Admin" (persona_id, fecha_alta)
    VALUES (v_persona_id, CURRENT_DATE);

    RAISE NOTICE 'Admin creado: admin@proyectolector.com / 123456';
  ELSE
    RAISE NOTICE 'Admin admin@proyectolector.com ya existe.';
  END IF;
END $$;
