/**
 * k6 - Prueba de estrés: hasta 1000 usuarios con ramp-up para no saturar de golpe
 * Objetivo: ver si la app aguanta tráfico alto sin petar
 *
 * Uso:
 *   k6 run load-test-k6.js
 *e 
 * Ajusta USUARIOS_SIMULTANEOS y las credenciales abajo
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

// ========== CONFIGURA AQUÍ ==========
const USUARIOS_SIMULTANEOS = 1000;
const BASE_URL = 'http://localhost:3000';
const CREDENTIALS = { email: 'daniel@gmail.com', password: 'dani123' };
/** Rampa: subir de 0 a USUARIOS_SIMULTANEOS en este tiempo (evita pico instantáneo) */
const RAMP_UP_DURATION = '15s';
/** Timeout por petición cuando el servidor va cargado */
const REQUEST_TIMEOUT = '120s';
// ====================================

export const options = {
  scenarios: {
    // Ramp-up: de 0 a N usuarios en RAMP_UP_DURATION, cada uno hace 1 login
    carga_gradual: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_DURATION, target: USUARIOS_SIMULTANEOS },
        { duration: '10s', target: USUARIOS_SIMULTANEOS }, // mantiene 10s a tope
      ],
      startTime: '0s',
      gracefulRampDown: '15s',
      gracefulStop: '15s',
    },
  },
  thresholds: {
    'checks{check:status 200}': ['rate>=0.98'], // 98% ok (permite algo de 429 bajo estrés)
    http_req_duration: ['p(95)<120000'],        // p95 < 120s
    http_req_failed: ['rate<0.05'],              // menos del 5% fallos de conexión
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(CREDENTIALS),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
    }
  );

  check(res, {
    'status 200': (r) => r.status === 200,
    'sin error 5xx': (r) => r.status < 500,
  });

  if (res.status !== 200) {
    console.error(`Fallo: status=${res.status} body=${res.body?.slice(0, 200)}`);
  }

  // 1 petición por VU: después del request este VU no hace más (sleep más largo que la prueba)
  sleep(300);
}

export function handleSummary(data) {
  const s = data?.metrics || {};
  const total = s.http_reqs?.values?.count ?? 0;
  const dur = s.http_req_duration?.values ?? {};
  const checks = data?.root_group?.checks ?? [];
  const status200Check = checks.find((c) => c.name === 'status 200');
  const ok200 = status200Check?.passes ?? 0;
  const fail200 = status200Check?.fails ?? 0;
  const summary = `
=== Resultado carga (${USUARIOS_SIMULTANEOS} usuarios, ramp-up ${RAMP_UP_DURATION}) ===
Total peticiones: ${total}
Status 200:      ${ok200}  (login exitoso)
No 200:          ${fail200}  (401, 429, 5xx, etc.)
Latencia mediana: ${dur.med ?? '-'} ms  |  p95: ${dur['p(95)'] ?? '-'} ms
========================================
`;
  return { stdout: summary, 'load-test-result.json': JSON.stringify(data, null, 2) };
}
