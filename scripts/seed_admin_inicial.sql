-- =============================================================================
-- Seed de admin: NO se versiona ninguna contraseña aquí.
-- Usa el script seguro (bcrypt, variables de entorno):
--   node scripts/seed-admin.cjs
-- Variables: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (y opcionales, ver script).
-- Requiere columnas de Persona tal como en migrations/complete_database_setup.sql
-- y migraciones en migrations/.
-- =============================================================================
DO $$
BEGIN
  RAISE EXCEPTION
    'No ejecutes este archivo. Usa: node scripts/seed-admin.cjs (desde el directorio ApiLector) con SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.';
END $$;
