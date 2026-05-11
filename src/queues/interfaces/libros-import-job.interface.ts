export interface LibrosImportJobPayload {
  libroId: number;
  codigo: string;
  /** Key/ruta relativa del PDF en Supabase Storage */
  rutaPdfRelativa: string;
  auditContext?: { usuarioId?: number | null; ip?: string | null };
  /** W3C trace context (propagación API → worker) */
  traceContext?: Record<string, string>;
}
