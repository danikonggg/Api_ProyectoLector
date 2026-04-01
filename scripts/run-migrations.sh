#!/bin/bash
# ============================================
# Ejecuta las migraciones SQL de grupos en orden
# ============================================
# Uso: ./scripts/run-migrations.sh [database_url]
#      chmod +x scripts/run-migrations.sh  # una vez
# Si no se pasa database_url, usa variables de entorno o fallback.
# ============================================

set -e

DB_URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/api_lector}}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

echo "🔄 Ejecutando migraciones en: $DB_URL"
echo "📁 Directorio: $MIGRATIONS_DIR"
echo ""

run_sql() {
  local file="$1"
  if [ -f "$file" ]; then
    echo "▶ $file"
    psql "$DB_URL" -f "$file" -v ON_ERROR_STOP=1
    echo "✅ OK"
  else
    echo "⚠️  No existe: $file"
    exit 1
  fi
}

# Orden: tablas base, luego relaciones
run_sql "$MIGRATIONS_DIR/add_grupo_table.sql"
run_sql "$MIGRATIONS_DIR/add_maestro_grupo_table.sql"
run_sql "$MIGRATIONS_DIR/add_alumno_grupo_id.sql"

# Backfill (opcional - solo si hay alumnos existentes)
if [ -f "$MIGRATIONS_DIR/backfill_alumno_grupo_id.sql" ]; then
  echo ""
  echo "▶ backfill_alumno_grupo_id.sql (migración de datos)"
  psql "$DB_URL" -f "$MIGRATIONS_DIR/backfill_alumno_grupo_id.sql" -v ON_ERROR_STOP=1
  echo "✅ OK"
fi

echo ""
echo "🎉 Migraciones completadas"
