/**
 * Crea un administrador inicial de forma idempotente (Node + bcrypt; sin contraseñas fijas en el repo).
 *
 * Uso (desde el directorio ApiLector, con .env o variables exportadas):
 *   node scripts/seed-admin.cjs
 *
 * Requerido:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Conexión: DATABASE_URL, o (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE)
 *
 * Opcional: SEED_ADMIN_NOMBRE, SEED_ADMIN_APELLIDO_PATERNO, SEED_ADMIN_APELLIDO_MATERNO
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

function loadDotEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const k = m[1];
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

function buildConnectionString() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USERNAME;
  const pass = process.env.DB_PASSWORD;
  const db = process.env.DB_DATABASE;
  if (!user || !pass || !db) {
    throw new Error('Configura DATABASE_URL o DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE');
  }
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
}

async function main() {
  loadDotEnv();

  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  const minLen = Math.max(6, parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10) || 8);
  if (!email) {
    console.error('Error: define SEED_ADMIN_EMAIL (correo del admin a crear).');
    process.exit(1);
  }
  if (password.length < minLen) {
    console.error(`Error: SEED_ADMIN_PASSWORD debe tener al menos ${minLen} caracteres.`);
    process.exit(1);
  }

  const nombre = (process.env.SEED_ADMIN_NOMBRE || 'Admin').trim() || 'Admin';
  const apPaterno = (process.env.SEED_ADMIN_APELLIDO_PATERNO || 'Sistema').trim() || 'Sistema';
  const apMaterno = (process.env.SEED_ADMIN_APELLIDO_MATERNO || '').trim() || null;

  const client = new Client({ connectionString: buildConnectionString() });
  await client.connect();

  try {
    const exist = await client.query(
      `SELECT 1
       FROM "Admin" a
       INNER JOIN "Persona" p ON p.id = a.persona_id
       WHERE LOWER(p.correo) = LOWER($1)`,
      [email],
    );
    if (exist.rowCount > 0) {
      console.log(`Listo: ya existe un admin con correo ${email}. Nada que hacer.`);
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const ins = await client.query(
      `INSERT INTO "Persona" (
         nombre, apellido_paterno, apellido_materno, correo, telefono, fecha_nacimiento, genero,
         password, tipo_persona, activo
       ) VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, 'administrador', true)
       RETURNING id`,
      [nombre, apPaterno, apMaterno, email, hash],
    );
    const personaId = ins.rows[0].id;
    await client.query(`INSERT INTO "Admin" (persona_id, fecha_alta) VALUES ($1, CURRENT_DATE)`, [
      personaId,
    ]);
    console.log(
      `Admin creado: ${email} (persona_id=${personaId}). Inicia sesión con la contraseña que enviaste en SEED_ADMIN_PASSWORD (no se muestra en consola).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
