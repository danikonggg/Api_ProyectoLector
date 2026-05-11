if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'e2e-jwt-test-secret-32-chars-minimum-ok';
}
if (!process.env.METRICS_TOKEN || process.env.METRICS_TOKEN.length < 8) {
  process.env.METRICS_TOKEN = 'e2e-metrics-token-8chars-min-ok-';
}
if (!process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS = 'http://localhost:3000';
}
