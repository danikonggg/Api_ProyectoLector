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
  TITULO_CAPITULO,
  LIGADURAS,
  COMILLAS_UNICODE,
} from './constants/pdf.constants';

/**
 * Reemplaza todos los espacios Unicode por espacio normal.
 */
function normalizarEspaciosUnicode(texto: string): string {
  return texto.replace(UNICODE_SPACES, ' ');
}

/**
 * Elimina caracteres de control y no imprimibles (mantiene \n \r \t).
 */
function eliminarControlYInvisibles(texto: string): string {
  return texto
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '');
}

/**
 * Normaliza saltos de línea a \n.
 */
function normalizarSaltosLinea(texto: string): string {
  return texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normaliza comillas tipográficas y guiones Unicode a ASCII.
 */
function normalizarComillasYGuiones(texto: string): string {
  let t = texto;
  for (const [unicode, ascii] of COMILLAS_UNICODE) {
    t = t.split(unicode).join(ascii);
  }
  return t;
}

/**
 * Reemplaza ligaduras tipográficas (ﬁ, ﬂ, ﬀ, etc.) por caracteres normales.
 */
function normalizarLigaduras(texto: string): string {
  let t = texto;
  for (const [lig, rep] of Object.entries(LIGADURAS)) {
    t = t.split(lig).join(rep);
  }
  return t;
}

/**
 * Une palabras partidas por guión al final de línea (ej. "ejem-\nplo" → "ejemplo").
 * Incluye soft hyphen (\\u00AD), guion normal y variantes.
 */
function unirPalabrasPartidasPorGuion(texto: string): string {
  let t = texto;
  const letras =
    '[a-zA-ZáéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜ]';
  const guion = '[\\-\\u00AD\\u2010\\u2011]';
  const pat = new RegExp(
    `(${letras})${guion}\\s*\\n\\s*(${letras})`,
    'g',
  );
  t = t.replace(pat, '$1$2');
  const pat2 = new RegExp(`(${letras})${guion}\\s+(${letras})`, 'g');
  t = t.replace(pat2, '$1$2');
  return t;
}

/**
 * Reemplaza tabs por espacios y colapsa espacios múltiples (dentro de línea).
 */
function colapsarEspacios(texto: string): string {
  return texto.replace(/\t/g, ' ').replace(/[ \t]+/g, ' ');
}

/**
 * Trim por línea y colapsa líneas vacías múltiples (máx. 2 saltos = 1 párrafo).
 */
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

/**
 * Quita marcadores de página embebidos (ej. "-- 1 of 35 --") que aparecen en medio del texto.
 */
function quitarMarcadoresPaginaEmbebidos(texto: string): string {
  return texto.replace(PAGINA_EMBEBIDA, (m) => (m.startsWith('\n') ? '\n' : ''));
}

/**
 * Elimina líneas que parecen número de página o header/footer repetido.
 */
function quitarLineasHeaderFooter(texto: string): string {
  const lineas = texto.split('\n');
  const filtradas = lineas.filter((linea) => {
    const t = linea.trim();
    if (!t) return true;
    return !FOOTER_HEADER_PATTERNS.some((re) => re.test(t));
  });
  return filtradas.join('\n');
}

/**
 * Simplifica líneas de índice: "Agradecimientos ......... 11" -> "Agradecimientos"
 */
function simplificarLineasIndice(texto: string): string {
  const lineas = texto.split('\n');
  const simplificadas = lineas.map((linea) => {
    const t = linea.trim();
    const m = t.match(LINEA_INDICE);
    if (m) return m[1]!.trim();
    return t;
  });
  return simplificadas.join('\n');
}

/**
 * Quita líneas que son solo títulos de capítulo/sección (Introducción, Capítulo 1, etc.)
 * para dejar solo el contenido real del libro.
 */
function quitarLineasTitulo(texto: string): string {
  const lineas = texto.split('\n');
  const resultado: string[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!.trim();
    if (!linea) {
      resultado.push('');
      continue;
    }
    if (TITULO_CAPITULO.test(linea)) continue;
    resultado.push(linea);
  }

  return resultado.join('\n');
}

/**
 * Pipeline completo de limpieza.
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
  t = quitarLineasTitulo(t);
  t = trimLineasYColapsarParrafos(t);
  t = t.replace(/\u00AD/g, '');
  t = reemplazarSaltosPorEspacio(t);
  return t;
}

/**
 * Reemplaza saltos de línea por espacio para lectura fluida.
 * Los \n del PDF (saltos de página/línea) dañan la lectura; un espacio fluye mejor.
 */
function reemplazarSaltosPorEspacio(texto: string): string {
  return texto
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
