export const LIBROS_IMPORT_QUEUE = 'libros-import';

/** jobId BullMQ = evita duplicar jobs para el mismo libro */
export function librosImportJobId(libroId: number): string {
  return `libro-import-${libroId}`;
}

export const LOCK_LIBRO_IMPORT_PREFIX = 'lock:libro-import:';

/**
 * TTL del lock distribuido (segundos). Por defecto 24h; configurable para PDFs muy grandes.
 * Mínimo 60s; máximo 7 días.
 */
export function libroImportLockTtlSec(): number {
  const raw = process.env.LIBRO_IMPORT_LOCK_TTL_SEC;
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 60) {
    return 86400;
  }
  return Math.min(n, 7 * 24 * 3600);
}
