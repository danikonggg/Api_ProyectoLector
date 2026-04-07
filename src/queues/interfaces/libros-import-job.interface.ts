export interface LibrosImportJobPayload {
  libroId: number;
  codigo: string;
  /** Ruta relativa ya guardada en API (pdfs/...) */
  rutaPdfRelativa: string;
  auditContext?: { usuarioId?: number | null; ip?: string | null };
  /** W3C trace context (propagación API → worker) */
  traceContext?: Record<string, string>;
}
