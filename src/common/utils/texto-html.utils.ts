/**
 * Convierte el contenido de un segmento (texto plano) a HTML semántico
 * que se parece a la estructura original del PDF.
 *
 * Detecta automáticamente:
 * - Párrafos normales → <p>
 * - Listas numeradas  → <ol><li>
 * - Listas con viñeta → <ul><li>
 * - Diálogos (— …)   → <p class="dialogo">
 * - Subtítulos cortos → <h3>
 */
export function textoAHtml(texto: string): string {
  if (!texto?.trim()) return '';

  // Dividir por párrafos reales (\n\n)
  const bloques = texto
    .split(/\n\n+/)
    .map((b) => b.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  const partes: string[] = [];
  let listaActual: 'ol' | 'ul' | null = null;

  const cerrarLista = () => {
    if (listaActual) {
      partes.push(`</${listaActual}>`);
      listaActual = null;
    }
  };

  for (const bloque of bloques) {
    const e = escaparHtml(bloque);

    // ── Lista numerada: "1. Texto", "2. Texto" ──────────────────────────────
    const matchNumero = bloque.match(/^(\d{1,2})[.)]\s+(.+)$/);
    if (matchNumero) {
      if (listaActual !== 'ol') {
        cerrarLista();
        partes.push('<ol>');
        listaActual = 'ol';
      }
      partes.push(`  <li>${escaparHtml(matchNumero[2]!)}</li>`);
      continue;
    }

    // ── Lista con viñeta: "• Texto", "- Texto", "* Texto" ──────────────────
    const matchViñeta = bloque.match(/^[•\-–\*]\s+(.+)$/);
    if (matchViñeta) {
      if (listaActual !== 'ul') {
        cerrarLista();
        partes.push('<ul>');
        listaActual = 'ul';
      }
      partes.push(`  <li>${escaparHtml(matchViñeta[1]!)}</li>`);
      continue;
    }

    // Cualquier otro bloque cierra la lista en curso
    cerrarLista();

    // ── Diálogo: empieza con guión largo o raya ─────────────────────────────
    if (/^[—–-]\s/.test(bloque)) {
      partes.push(`<p class="dialogo">${e}</p>`);
      continue;
    }

    // ── Subtítulo: corto, sin puntuación final, primera letra mayúscula ─────
    if (esSubtitulo(bloque)) {
      partes.push(`<h3>${e}</h3>`);
      continue;
    }

    // ── Párrafo normal ───────────────────────────────────────────────────────
    partes.push(`<p>${e}</p>`);
  }

  cerrarLista();

  return partes.join('\n');
}

/**
 * Detecta si un bloque de texto es un subtítulo:
 * - Corto (≤ 80 chars)
 * - No termina con punto, coma, punto y coma
 * - Empieza con mayúscula o está en MAYÚSCULAS
 * - Máximo 10 palabras (no es una oración normal)
 */
function esSubtitulo(texto: string): boolean {
  if (texto.length > 80) return false;
  if (/[.,;]$/.test(texto)) return false; // termina como oración → no es título
  if (texto.split(/\s+/).length > 10) return false; // demasiadas palabras

  const esMayusculas = texto === texto.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(texto);
  const empiezaMayuscula = /^[A-ZÁÉÍÓÚÑ]/.test(texto);
  const sinPuntuacionMedio = !texto.includes('?') && !texto.includes('!');

  return (esMayusculas || empiezaMayuscula) && sinPuntuacionMedio;
}

/**
 * Escapa caracteres especiales HTML para evitar XSS.
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
