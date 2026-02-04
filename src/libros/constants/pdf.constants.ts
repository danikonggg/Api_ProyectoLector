/**
 * Constantes y patrones para procesamiento robusto de PDFs.
 * Validación, limpieza y segmentación.
 */

export const PDF = {
  /** Bytes mágicos de un PDF válido */
  MAGIC: Buffer.from('%PDF', 'utf8'),
  /** Marcador EOF estándar (puede no estar en todos los PDFs) */
  EOF_MARKER: Buffer.from('%%EOF', 'utf8'),
  /** Mínimo de bytes para considerar un archivo (evitar vacíos o truncados) */
  MIN_SIZE: 100,
  /** Máximo de bytes (evitar DoS); ~200 MB */
  MAX_SIZE: 200 * 1024 * 1024,
  /** Mínimo de caracteres de texto extraído para considerar válido */
  MIN_TEXT_LENGTH: 50,
  /** Si el texto tiene menos de esto, suele ser escaneado/solo imágenes */
  MIN_TEXT_LENGTH_ESCANEADO: 20,
  /** Máximo de páginas a parsear (0 = todas). Evitar docs gigantes. */
  MAX_PAGES: 0,
} as const;

export const SEGMENTOS = {
  MIN_WORDS: 200,
  MAX_WORDS: 500,
  TARGET_WORDS: 350,
  MIN_WORDS_SEGMENT: 10,
  MIN_WORDS_REST: 50,
  /** Resto final con menos palabras: se emite igual si >= esto (no perder contenido) */
  MIN_WORDS_FLUSH_REST: 1,
  MIN_WORDS_PARRAFO: 3,
  MIN_LEN_PARRAFO: 10,
  /** Máximo de palabras por “frase” al dividir por oraciones */
  MAX_PALABRAS_FRASE_CORTE: 80,
} as const;

/** Delimitadores de oración para segmentar (incluye espacios/saltos opcionales). */
export const ORACION_REGEX = /[.!?…¿¡]+[\s\n]*|[\n]{2,}/g;

/** Líneas que parecen solo número de página o "Pág. X de Y" (pie/encabezado). */
export const FOOTER_HEADER_PATTERNS = [
  /^\s*\d{1,5}\s*$/,
  /^\s*-\s*\d{1,5}\s*-\s*$/,
  /^\s*—\s*\d{1,5}\s*—\s*$/,
  /^\s*--\s*\d{1,5}\s+(?:of|de)\s+\d{1,5}\s*--\s*$/i,
  /^\s*-\s*\d{1,5}\s+(?:of|de)\s+\d{1,5}\s*-\s*$/i,
  /^\s*Página\s+\d{1,5}\s+(?:de|\/)\s*\d{1,5}\s*$/i,
  /^\s*Page\s+\d{1,5}\s+(?:of|\/)\s*\d{1,5}\s*$/i,
  /^\s*Pág\.?\s*\d{1,5}\s*(?:de|\/)\s*\d{1,5}\s*$/i,
  /^\s*\d{1,5}\s+(?:de|\/)\s*\d{1,5}\s*$/,
];

/** Patrones para quitar marcadores de página embebidos (ej. "-- 1 of 35 --" en medio del texto). */
export const PAGINA_EMBEBIDA =
  /(?:\n|^)\s*--\s*\d{1,5}\s+(?:of|de)\s+\d{1,5}\s*--\s*(?=\n|$)/gi;

/** Línea de índice: "Texto ...................... 11" -> queda solo "Texto". */
export const LINEA_INDICE = /^(.+?)\s*[.\s]{3,}\s*\d{1,5}\s*$/;

/** Patrones de títulos de capítulo o sección principal (para marcar con ##). */
export const TITULO_CAPITULO =
  /^(Capítulo\s+\d+[.:]?\s*.+|Chapter\s+\d+[.:]?\s*.+|Cap\.\s*\d+[.:]?\s*.+|\d+\.\s+[A-ZÁÉÍÓÚÑ].+|[IVXLCDM]+\.\s+[A-ZÁÉÍÓÚÑa-záéíóú].+|Introducci[oó]n|Pr[oó]logo|Ep[ií]logo|Conclusi[oó]n|Anexos?|Bibliograf[ií]a|[IÍ]ndice|Prefacio|Agradecimientos|Parte\s+[IVXLCDMivxlcdm\d]+[.:]?\s*.+|Part\s+\d+[.:]?\s*.+)$/im;

/** Patrones de subtítulos/secciones (líneas cortas, sin punto final). */
export const MAX_CHARS_SUBTITULO = 80;

/** Caracteres de espacio Unicode a normalizar a espacio normal. */
export const UNICODE_SPACES = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;

/** Caracteres de control y no imprimibles (salvo \n \t \r). */
export const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Zero-width y otros invisibles (soft hyphen \u00AD se trata en unión por guión). */
export const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Mapa de ligaduras tipográficas a caracteres normales.
 * PDFs suelen usar ligaduras (ﬁ, ﬂ, ﬀ, etc.) que rompen búsquedas y segmentación.
 */
export const LIGADURAS: Record<string, string> = {
  '\uFB00': 'ff', // ﬀ
  '\uFB01': 'fi', // ﬁ
  '\uFB02': 'fl', // ﬂ
  '\uFB03': 'ffi', // ﬃ
  '\uFB04': 'ffl', // ﬄ
  '\uFB05': 'ft', // ﬅ
  '\uFB06': 'st', // ﬆ
  '\u00C6': 'AE', // Æ
  '\u00E6': 'ae', // æ
  '\u0152': 'OE', // Œ
  '\u0153': 'oe', // œ
};

/** Comillas tipográficas a normalizar. */
export const COMILLAS_UNICODE = [
  ['\u201C', '"'], // "
  ['\u201D', '"'], // "
  ['\u2018', "'"], // '
  ['\u2019', "'"], // '
  ['\u2010', '-'], // hyphen
  ['\u2011', '-'], // non-breaking hyphen
  ['\u2012', '-'], // figure dash
  ['\u2013', '-'], // en-dash
  ['\u2014', '-'], // em-dash
];

