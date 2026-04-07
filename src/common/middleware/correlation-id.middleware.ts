import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Primero en el stack Express (main.ts) para que Pino y el resto vean correlationId. */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
  const id =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : randomUUID();
  (req as Request & { correlationId: string }).correlationId = id;
  res.setHeader('x-request-id', id);
  next();
}
