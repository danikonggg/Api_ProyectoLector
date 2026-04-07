/**
 * k6 — Simular muchos alumnos pidiendo "mis libros" (y opcionalmente el detalle de un libro)
 *
 * Flujo:
 *   1) setup(): un solo POST /auth/login (evita el límite 5 login/min por IP de Nest).
 *   2) N usuarios virtuales en paralelo: GET /escuelas/mis-libros con JWT de alumno.
 *   3) Si defines LIBRO_ID: además GET /libros/:id (misma sesión, "abrir" ese libro).
 *
 * Requisitos: cuenta real con rol alumno y libros asignados (o al menos token válido).
 *
 * Uso:
 *   k6 run load-test-k6-alumno-mis-libros.js
 *
 * Con variables (recomendado):
 *   K6_ALUMNO_EMAIL=alumno@test.com K6_ALUMNO_PASSWORD=secret k6 run load-test-k6-alumno-mis-libros.js
 *
 * Opcional — probar también detalle de un libro (todos piden el mismo id):
 *   K6_LIBRO_ID=42 k6 run load-test-k6-alumno-mis-libros.js
 *
 * Ajustar picos:
 *   K6_VUS=500 k6 run load-test-k6-alumno-mis-libros.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const ALUMNO_EMAIL = __ENV.K6_ALUMNO_EMAIL || 'daniel@gmail.com';
const ALUMNO_PASSWORD = __ENV.K6_ALUMNO_PASSWORD || 'dani123';
const VUS = Number(__ENV.K6_VUS || 500);
const LIBRO_ID = __ENV.K6_LIBRO_ID ? String(__ENV.K6_LIBRO_ID).trim() : '';
const REQUEST_TIMEOUT = '120s';

export const options = {
  scenarios: {
    /** Cada VU ejecuta 1 iteración → ~N peticiones en paralelo al inicio */
    alumno_mis_libros: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '5m',
      startTime: '0s',
    },
  },
  thresholds: {
    'checks{check:mis-libros 200}': ['rate>=0.95'],
    http_req_duration: ['p(95)<120000'],
    http_req_failed: ['rate<0.1'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ALUMNO_EMAIL, password: ALUMNO_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
    },
  );

  if (res.status !== 200) {
    throw new Error(
      `[setup] Login falló status=${res.status} body=${String(res.body).slice(0, 300)} — Usa K6_ALUMNO_EMAIL / K6_ALUMNO_PASSWORD de un alumno real.`,
    );
  }

  let body;
  try {
    body = JSON.parse(res.body);
  } catch {
    throw new Error('[setup] Respuesta de login no es JSON');
  }

  const token = body.access_token;
  if (!token) {
    throw new Error('[setup] No hay access_token en la respuesta (¿credenciales de administrador en vez de alumno?)');
  }

  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    Accept: 'application/json',
  };

  const resList = http.get(`${BASE_URL}/escuelas/mis-libros`, {
    headers,
    timeout: REQUEST_TIMEOUT,
  });

  check(resList, {
    'mis-libros 200': (r) => r.status === 200,
    'mis-libros sin 5xx': (r) => r.status < 500,
  });

  if (resList.status !== 200) {
    console.error(`mis-libros status=${resList.status} body=${String(resList.body).slice(0, 200)}`);
  }

  if (LIBRO_ID) {
    const resLibro = http.get(`${BASE_URL}/libros/${encodeURIComponent(LIBRO_ID)}`, {
      headers,
      timeout: REQUEST_TIMEOUT,
    });
    check(resLibro, {
      'libro detalle 200': (r) => r.status === 200,
      'libro detalle sin 5xx': (r) => r.status < 500,
    });
    if (resLibro.status !== 200) {
      console.error(`libros/${LIBRO_ID} status=${resLibro.status} body=${String(resLibro.body).slice(0, 200)}`);
    }
  }

  sleep(0.05);
}

export function handleSummary(data) {
  const s = data?.metrics || {};
  const total = s.http_reqs?.values?.count ?? 0;
  const dur = s.http_req_duration?.values ?? {};
  const summary = `
=== k6 alumno: mis-libros (${VUS} VU × 1 iter)${LIBRO_ID ? ` + GET /libros/${LIBRO_ID}` : ''} ===
Base: ${BASE_URL}
Total peticiones HTTP: ${total}
p95 duración: ${dur['p(95)'] ?? '-'} ms
========================================
`;
  return { stdout: summary, 'load-test-alumno-mis-libros.json': JSON.stringify(data, null, 2) };
}
