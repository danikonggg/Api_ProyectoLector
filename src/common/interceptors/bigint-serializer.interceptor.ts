import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)]),
    );
  }
  return value;
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeBigInts(data)));
  }
}
