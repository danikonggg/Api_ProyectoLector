/** Redis configurado (cola Bull + caché JWT). Sin esto: carga de libros síncrona y JWT sin caché Redis. */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim()
  );
}
