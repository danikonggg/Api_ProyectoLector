/**
 * Ejecuta la migración add_activo_alumno_maestro_director.sql
 * Uso: node scripts/run-migration-activo.cjs
 * Requiere .env con DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('.env no encontrado, usando variables de entorno del sistema');
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

loadEnv();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'api_lector',
});

const sqls = [
  `ALTER TABLE "Alumno" ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;`,
  `ALTER TABLE "Maestro" ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;`,
  `ALTER TABLE "Director" ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;`,
];

async function run() {
  try {
    await client.connect();
    for (const sql of sqls) {
      await client.query(sql);
      console.log('OK:', sql.slice(0, 50) + '...');
    }
    console.log('Migración add_activo_alumno_maestro_director completada.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
