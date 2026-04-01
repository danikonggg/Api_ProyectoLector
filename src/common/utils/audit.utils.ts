import type { Request } from 'express';
import { getClientIp } from './request.utils';

export interface AuditContext {
  usuarioId?: number | null;
  ip?: string | null;
}

/**
 * Extrae el contexto de auditoría del request.
 * Centraliza la lógica usada en controladores.
 */
export function getAuditContext(req: Request & { user?: { id?: number } }): AuditContext {
  const ip = getClientIp(req);
  return {
    usuarioId: req.user?.id ?? null,
    ip: typeof ip === 'string' ? ip : undefined,
  };
}
