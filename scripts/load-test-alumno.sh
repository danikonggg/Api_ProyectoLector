#!/usr/bin/env bash
# Prueba de carga k6 — alumno: mis-libros (+ opcional detalle de libro).
# Requiere: k6 instalado (`brew install k6`) y API levantada.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${K6_ALUMNO_EMAIL:-}" || -z "${K6_ALUMNO_PASSWORD:-}" ]]; then
  cat << 'EOF'
Faltan credenciales de alumno.

Ejemplo (lista de libros solamente):
  K6_ALUMNO_EMAIL=tu@correo.com K6_ALUMNO_PASSWORD=clave \
    ./scripts/load-test-alumno.sh

Ejemplo (lista + "abrir" un libro — mismo flujo que entrar al libro):
  K6_ALUMNO_EMAIL=tu@correo.com K6_ALUMNO_PASSWORD=clave K6_LIBRO_ID=1 \
    ./scripts/load-test-alumno.sh

Opcionales:
  K6_VUS=100              peticiones en paralelo (default: 50)
  K6_BASE_URL=http://localhost:3000
EOF
  exit 1
fi

export K6_VUS="${K6_VUS:-50}"
export K6_BASE_URL="${K6_BASE_URL:-http://localhost:3000}"

echo "=== k6 alumno ==="
echo "BASE_URL=$K6_BASE_URL  VUS=$K6_VUS  LIBRO_ID=${K6_LIBRO_ID:-(solo mis-libros)}"
echo ""

exec k6 run load-test-k6-alumno-mis-libros.js
