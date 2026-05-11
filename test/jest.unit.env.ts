if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'unit-test-jwt-secret-must-reach-32-chars-';
}
if (!process.env.METRICS_TOKEN || process.env.METRICS_TOKEN.length < 8) {
  process.env.METRICS_TOKEN = 'unit-test-metrics-token-8min';
}
