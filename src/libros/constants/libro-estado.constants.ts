/**
 * Estados del pipeline de procesamiento de libros.
 * Permiten seguimiento fino cuando el procesamiento es asíncrono.
 */

export const LIBRO_ESTADO = {
  PENDIENTE: 'pendiente',
  EXRAYENDO: 'extrayendo',
  SEGMENTANDO: 'segmentando',
  GUARDANDO: 'guardando',
  GENERANDO_PREGUNTAS: 'generando_preguntas',
  LISTO: 'listo',
  PROCESANDO: 'procesando', // Legacy: todo en uno (sync)
  ERROR: 'error',
} as const;

export type LibroEstado = (typeof LIBRO_ESTADO)[keyof typeof LIBRO_ESTADO];

/** Estados intermedios (procesamiento en curso) */
export const ESTADOS_EN_PROCESO: LibroEstado[] = [
  LIBRO_ESTADO.PENDIENTE,
  LIBRO_ESTADO.EXRAYENDO,
  LIBRO_ESTADO.SEGMENTANDO,
  LIBRO_ESTADO.GUARDANDO,
  LIBRO_ESTADO.GENERANDO_PREGUNTAS,
  LIBRO_ESTADO.PROCESANDO,
];

export const estaEnProceso = (estado: string): boolean =>
  ESTADOS_EN_PROCESO.includes(estado as LibroEstado);

export const estaListo = (estado: string): boolean =>
  estado === LIBRO_ESTADO.LISTO;

export const estaEnError = (estado: string): boolean =>
  estado === LIBRO_ESTADO.ERROR;
