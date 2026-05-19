import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AuditService } from '../audit.service';
import { getClientIp } from '../../common/utils/request.utils';
import type { PersonaPrincipal } from '../../auth/services/jwt-persona-loader.service';

/** Métodos que modifican estado; GET/HEAD/OPTIONS no se auditan aquí. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Campos del body que NUNCA se loguean en texto plano por seguridad */
const SENSITIVE_FIELDS = new Set(['password', 'nuevaPassword', 'token', 'refresh_token', 'pass']);

function normalizePath(url: string): string {
  const q = url.indexOf('?');
  return q >= 0 ? url.slice(0, q) : url;
}

function buildAccion(method: string, path: string): string {
  const s = `${method} ${path}`;
  return s.length <= 80 ? s : `${s.slice(0, 77)}...`;
}

function parseSkipPaths(): string[] {
  const raw = process.env.AUDIT_HTTP_SKIP_PATHS ?? '/auth/login';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function shouldSkipPath(path: string, skips: string[]): boolean {
  return skips.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Censura los campos sensibles del body antes de loguearlo */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
    result[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '***' : val;
  }
  return result;
}

/**
 * Interceptor global: registra en audit_log cada mutación HTTP exitosa
 * y emite una línea de log en consola con método, ruta, usuario, IP,
 * status y tiempo de respuesta.
 */
@Injectable()
export class AuditHttpInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.AUDIT_HTTP_ENABLED === 'false') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: PersonaPrincipal }>();
    const res = http.getResponse<Response>();
    const method = (req.method || '').toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const path = normalizePath(req.originalUrl || req.url || '');
    if (shouldSkipPath(path, parseSkipPaths())) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms      = Date.now() - startedAt;
        const status  = res.statusCode;
        const ip      = getClientIp(req) ?? 'unknown';
        const userId  = req.user?.id != null ? Number(req.user.id) : null;
        const role    = req.user?.tipoPersona ?? 'anon';
        const accion  = buildAccion(method, path);

        // ── Consola ──────────────────────────────────────────────────────
        const bodySnippet = req.body && Object.keys(req.body).length
          ? ` body=${JSON.stringify(sanitizeBody(req.body))}`
          : '';

        const userTag = userId ? `uid=${userId} (${role})` : `anon`;

        this.logger.log(
          `${method} ${path} → ${status} | ${ms}ms | ${userTag} | ip=${ip}${bodySnippet}`,
        );

        // ── BD audit_log ─────────────────────────────────────────────────
        void this.auditService.log(accion, {
          usuarioId:    userId,
          ip,
          method,
          path,
          statusCode:   status,
          durationMs:   ms,
          tipoPersona:  role !== 'anon' ? role : null,
          bodySnapshot: req.body && Object.keys(req.body).length
            ? JSON.stringify(sanitizeBody(req.body))
            : null,
          detalles: null,
        });
      }),
    );
  }
}
