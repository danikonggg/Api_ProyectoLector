import type { Request } from 'express';

/**
 * Obtiene la IP del cliente, considerando proxy/load balancer.
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0]?.trim();
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp.trim();
  return req.ip;
}
