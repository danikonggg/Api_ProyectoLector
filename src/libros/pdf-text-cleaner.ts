/**
 * ============================================
 * Utilidad: Limpieza exhaustiva de texto extraído de PDF
 * ============================================
 * Normaliza espacios, quita caracteres raros, arregla guiones partidos,
 * elimina headers/footers típicos y preserva estructura de párrafos.
 */

import {
  UNICODE_SPACES,
  CONTROL_CHARS,
  ZERO_WIDTH,
  FOOTER_HEADER_PATTERNS,
  PAGINA_EMBEBIDA,
  LINEA_INDICE,
  LIGADURAS,
  COMILLAS_UNICODE,
} from './constants/pdf.constants';

function normalizarEspaciosUnicode(texto: string): string {
  return texto.replace(UNICODE_SPACES, ' ');
}

function eliminarControlYInvisibles(texto: string): string {
  return texto.replace(CONTROL_CHARS, '').replace(ZERO_WIDTH, '');
}

function normalizarSaltosLinea(texto: string): string {
  return texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizarComillasYGuiones(texto: string): string {
  let t = texto;
  for (const [unicode, ascii] of COMILLAS_UNICODE) {
    t = t.split(unicode).join(ascii);
  }
  return t;
}

function normalizarLigaduras(texto: string): string {
  let t = texto;
  for (const [lig, rep] of Object.entries(LIGADURAS)) {
    t = t.split(lig).join(rep);
  }
  return t;
}

function unirPalabrasPartidasPorGuion(texto: string): string {
  let t = texto;
  const letras = '[a-zA-ZáéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöÄËÏÖ]';
  const guion = '[\\-­‐‑]';
  const pat = new RegExp(`(${letras})${guion}\\s*\\n\\s*(${letras})`, 'g');
  t = t.replace(pat, '$1$2');
  const pat2 = new RegExp(`(${letras})${guion}\\s+(${letras})`, 'g');
  t = t.replace(pat2, '$1$2');
  return t;
}

function colapsarEspacios(texto: string): string {
  return texto.replace(/\t/g, ' ').replace(/[ \t]+/g, ' ');
}

function trimLineasYColapsarParrafos(texto: string): string {
  let t = texto
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
  t = t.replace(/\n{4,}/g, '\n\n\n');
  t = t.replace(/\n{3}/g, '\n\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function quitarMarcadoresPaginaEmbebidos(texto: string): string {
  return texto.replace(PAGINA_EMBEBIDA, (m) => (m.startsWith('\n') ? '\n' : ''));
}

function quitarLineasHeaderFooter(texto: string): string {
  const lineas = texto.split('\n');
  const filtradas = lineas.filter((linea) => {
    const t = linea.trim();
    if (!t) return true;
    return !FOOTER_HEADER_PATTERNS.some((re) => re.test(t));
  });
  return filtradas.join('\n');
}

function simplificarLineasIndice(texto: string): string {
  // Simplifica "Texto ........ 11" → "Texto" (quita número de página del ToC).
  // NO elimina la línea para no perder encabezados de capítulo reales.
  const lineas = texto.split('\n');
  return lineas
    .map((linea) => {
      const t = linea.trim();
      const m = t.match(LINEA_INDICE);
      return m ? m[1]!.trim() : t;
    })
    .join('\n');
}

/**
 * Pipeline completo de limpieza. Preserva estructura de \n y \n\n
 * para que la detección de capítulos y párrafos funcione correctamente.
 * NO aplica reemplazarSaltosPorEspacio — eso se hace por segmento al final.
 */
export function limpiarTextoPdf(texto: string): string {
  let t = texto;
  t = normalizarSaltosLinea(t);
  t = normalizarEspaciosUnicode(t);
  t = normalizarComillasYGuiones(t);
  t = normalizarLigaduras(t);
  t = eliminarControlYInvisibles(t);
  t = unirPalabrasPartidasPorGuion(t);
  t = colapsarEspacios(t);
  t = trimLineasYColapsarParrafos(t);
  t = quitarMarcadoresPaginaEmbebidos(t);
  t = quitarLineasHeaderFooter(t);
  t = simplificarLineasIndice(t);
  t = trimLineasYColapsarParrafos(t);
  // Elimina soft hyphens residuales
  t = t.replace(/­/g, '');
  return t;
}

/**
 * Normaliza el contenido de un segmento individual para lectura fluida.
 * Convierte saltos de línea simples (word-wrap del PDF) en espacios,
 * pero preserva párrafos reales (\n\n).
 */
export function normalizarContenidoSegmento(texto: string): string {
  return texto
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
