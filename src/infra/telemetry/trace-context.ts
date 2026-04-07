import { context, propagation, trace } from '@opentelemetry/api';

/**
 * Propaga el contexto de traza HTTP actual al payload del job (W3C traceparent).
 */
export function injectTraceContextForJob(): Record<string, string> | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return Object.keys(carrier).length > 0 ? carrier : undefined;
}

/**
 * Ejecuta el callback con el contexto extraído del job (continúa la traza API → worker).
 */
export async function runWithJobTraceContext<T>(
  carrier: Record<string, string> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!carrier || Object.keys(carrier).length === 0) {
    return fn();
  }
  const parentCtx = propagation.extract(context.active(), carrier);
  return context.with(parentCtx, fn);
}

export function getLibrosImportTracer() {
  return trace.getTracer('api-lector-libros-import');
}
