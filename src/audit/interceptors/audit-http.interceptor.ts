import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditService } from '../audit.service';
import { getClientIp } from '../../common/utils/request.utils';
import type { Persona } from '../../personas/entities/persona.entity';

/** Métodos que modifican estado; GET/HEAD/OPTIONS no se auditan aquí. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

/**
 * Interceptor global: registra en audit_log cada mutación HTTP exitosa.
 * Solo emite si el handler termina sin lanzar (2xx típicamente).
 */
@Injectable()
export class AuditHttpInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.AUDIT_HTTP_ENABLED === 'false') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: Persona }>();
    const method = (req.method || '').toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const path = normalizePath(req.originalUrl || req.url || '');
    if (shouldSkipPath(path, parseSkipPaths())) {
      return next.handle();
    }

    const usuarioId = req.user?.id ?? null;
    const tipoPersona = req.user?.tipoPersona ?? null;
    const ip = getClientIp(req) ?? null;

    return next.handle().pipe(
      tap(() => {
        const accion = buildAccion(method, path);
        const detalles = JSON.stringify({
          path,
          method,
          ...(tipoPersona ? { tipoPersona } : {}),
        });
        void this.auditService.log(accion, {
          usuarioId,
          ip,
          detalles,
        });
      }),
    );
  }
}
