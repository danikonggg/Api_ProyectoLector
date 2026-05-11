/**
 * Glosario por segmento: detección de términos, definiciones (fuentes web + Groq),
 * tablas `glosario` y `seccion_glosario`. Se precarga al importar un libro.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Segmento } from './entities/segmento.entity';
import { Glosario } from './entities/glosario.entity';
import { SeccionGlosario } from './entities/seccion-glosario.entity';
import { GroqService } from '../groq/groq.service';

@Injectable()
export class GlosarioSegmentoService {
  private readonly logger = new Logger(GlosarioSegmentoService.name);

  constructor(
    @InjectRepository(Segmento)
    private readonly segmentoRepository: Repository<Segmento>,
    @InjectRepository(Glosario)
    private readonly glosarioRepository: Repository<Glosario>,
    @InjectRepository(SeccionGlosario)
    private readonly seccionGlosarioRepository: Repository<SeccionGlosario>,
    private readonly groqService: GroqService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tras guardar segmentos del libro: genera glosario en BD para cada segmento (no bloquea HTTP si se llama con void).
   */
  async precargarGlosarioLibro(libroId: number): Promise<void> {
    const enabled = this.configService.get<string>('GLOSSARY_PRELOAD_ON_IMPORT', 'true');
    if (enabled === 'false' || enabled === '0') {
      this.logger.log(
        `Precarga glosario desactivada (GLOSSARY_PRELOAD_ON_IMPORT), libro ${libroId}`,
      );
      return;
    }

    const segmentos = await this.segmentoRepository.find({
      where: { libroId },
      select: ['id'],
      order: { id: 'ASC' },
    });

    this.logger.log(`Precargando glosario: libro ${libroId}, ${segmentos.length} segmentos`);

    for (const s of segmentos) {
      try {
        await this.obtenerGlosarioPorSegmento(s.id);
      } catch (e) {
        this.logger.warn(
          `Glosario segmento ${s.id} (libro ${libroId}): ${(e as Error)?.message ?? String(e)}`,
        );
      }
    }

    this.logger.log(`Precarga glosario terminada: libro ${libroId}`);
  }

  /**
   * Para adjuntar en GET /libros/:id — palabras ya cacheadas por segmento.
   */
  async obtenerMapaGlosarioPorSegmentos(
    segmentoIds: number[],
  ): Promise<Map<number, Array<{ palabra: string; definicion: string | null }>>> {
    const map = new Map<number, Array<{ palabra: string; definicion: string | null }>>();
    if (segmentoIds.length === 0) return map;

    const rows = await this.seccionGlosarioRepository.find({
      where: { segmentoId: In(segmentoIds) },
      order: { segmentoId: 'ASC', palabra: 'ASC' },
    });
    for (const id of segmentoIds) {
      map.set(id, []);
    }
    for (const r of rows) {
      const list = map.get(r.segmentoId);
      if (list) {
        list.push({ palabra: r.palabra, definicion: r.definicion });
      }
    }
    return map;
  }

  async obtenerGlosarioPorSegmento(segmentoId: number): Promise<{
    segmentoId: number;
    cache: boolean;
    palabras: Array<{ palabra: string; definicion: string | null }>;
  }> {
    const segmento = await this.segmentoRepository.findOne({
      where: { id: segmentoId },
      select: ['id', 'contenido'],
    });
    if (!segmento) {
      throw new NotFoundException(`No se encontró el segmento con ID ${segmentoId}`);
    }

    const cache = await this.seccionGlosarioRepository.find({
      where: { segmentoId },
      order: { palabra: 'ASC' },
    });
    if (cache.length > 0) {
      return {
        segmentoId,
        cache: true,
        palabras: cache.map((r) => ({
          palabra: r.palabra,
          definicion: r.definicion,
        })),
      };
    }

    const candidatas = this.extraerPalabrasClave(segmento.contenido);
    const payload: Array<{ palabra: string; definicion: string | null }> = [];

    for (const palabra of candidatas) {
      const definicion = await this.obtenerDefinicionPalabra(palabra);
      payload.push({ palabra, definicion });
    }

    if (payload.length > 0) {
      await this.seccionGlosarioRepository.insert(
        payload.map((p) => ({
          segmentoId,
          palabra: p.palabra,
          definicion: p.definicion,
        })),
      );
    }

    return {
      segmentoId,
      cache: false,
      palabras: payload,
    };
  }

  private extraerPalabrasClave(texto: string): string[] {
    const sinAcentos = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const tokens = sinAcentos.match(/[a-zñ]{4,}/g) ?? [];
    const stopwords = new Set([
      'para',
      'como',
      'porque',
      'sobre',
      'entre',
      'desde',
      'hasta',
      'donde',
      'estos',
      'estas',
      'esta',
      'este',
      'libro',
      'lectura',
      'texto',
      'tambien',
      'puede',
      'tiene',
      'cuando',
      'ellos',
      'ellas',
      'nosotros',
      'ustedes',
      'dicho',
      'dicha',
      'mismo',
      'misma',
      'alguna',
      'algunas',
      'alguno',
      'algunos',
      'adulta',
      'adulto',
      'adultos',
      'vida',
      'cosas',
      'persona',
      'personas',
      'nombre',
    ]);
    const exclusiones = new Set(['alberto', 'alfonso', 'beatriz', 'concha', 'lomejordetuvida']);

    const esTokenRuidoso = (token: string): boolean => {
      if (token.length > 16) return true;
      if (/(.)\1\1/.test(token)) return true;
      if (!/[aeiou]/.test(token)) return true;
      return false;
    };

    const contador = new Map<string, number>();
    for (const t of tokens) {
      if (t.length < 6 || stopwords.has(t) || exclusiones.has(t) || esTokenRuidoso(t)) continue;
      contador.set(t, (contador.get(t) ?? 0) + 1);
    }

    return [...contador.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([palabra]) => palabra);
  }

  /**
   * Registra una palabra en el glosario global: si ya está en BD devuelve cache; si no, busca en fuentes web y Groq.
   */
  async registrarPalabraEnGlosario(entrada: string): Promise<{
    palabra: string;
    definicion: string | null;
    origen: 'cache' | 'remoto';
  }> {
    const palabra = this.normalizarClaveGlosario(entrada);
    if (!palabra || palabra.length < 2) {
      throw new BadRequestException('La palabra no es válida después de normalizar.');
    }
    if (palabra.length > 180) {
      throw new BadRequestException('La palabra excede la longitud permitida.');
    }

    const existente = await this.glosarioRepository.findOne({ where: { palabra } });
    if (existente?.definicion) {
      return { palabra, definicion: existente.definicion, origen: 'cache' };
    }

    const definicion = await this.buscarDefinicionRemota(palabra);
    await this.persistirDefinicionGlosario(palabra, definicion, existente?.id ?? null);
    return { palabra, definicion, origen: 'remoto' };
  }

  private normalizarClaveGlosario(texto: string): string {
    return texto
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private async obtenerDefinicionPalabra(palabra: string): Promise<string | null> {
    const existente = await this.glosarioRepository.findOne({ where: { palabra } });
    if (existente?.definicion) {
      return existente.definicion;
    }

    const definicion = await this.buscarDefinicionRemota(palabra);
    await this.persistirDefinicionGlosario(palabra, definicion, existente?.id ?? null);
    return definicion;
  }

  private async persistirDefinicionGlosario(
    palabra: string,
    definicion: string | null,
    existenteId: number | null,
  ): Promise<void> {
    if (existenteId != null) {
      await this.glosarioRepository.update({ id: existenteId }, { definicion });
      return;
    }
    await this.glosarioRepository.insert({ palabra, definicion });
  }

  private async buscarDefinicionRemota(palabra: string): Promise<string | null> {
    const normalizada = palabra.trim().toLowerCase();
    if (!normalizada) return null;
    const variantes = this.generarVariantesBusqueda(normalizada);

    for (const termino of variantes) {
      const rest = await this.buscarDefinicionWiktionaryRest(termino);
      if (rest) return rest;

      const mediaWiki = await this.buscarDefinicionWiktionaryApi(termino);
      if (mediaWiki) return mediaWiki;

      const dictionaryApi = await this.buscarDefinicionDictionaryApi(termino);
      if (dictionaryApi) return dictionaryApi;

      const wikipedia = await this.buscarDefinicionWikipedia(termino);
      if (wikipedia) return wikipedia;
    }

    const groq = await this.groqService.definicionGlosario(normalizada);
    if (groq) return groq;

    return `Término detectado en la lectura: "${normalizada}". Definición externa no disponible en este momento.`;
  }

  private async buscarDefinicionWiktionaryRest(palabra: string): Promise<string | null> {
    try {
      const url = `https://es.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(palabra)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'ApiLector/1.0 glosario-mvp' },
      });
      if (!resp.ok) return null;

      const data = (await resp.json()) as Record<
        string,
        Array<{ definitions?: Array<{ definition?: string }> }>
      >;
      const esEntries = data.es ?? [];
      for (const entry of esEntries) {
        for (const def of entry.definitions ?? []) {
          const texto = def.definition?.trim();
          if (texto) {
            return this.limpiarDefinicion(texto, palabra);
          }
        }
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Wiktionary REST falló para "${palabra}": ${(error as Error)?.message ?? String(error)}`,
      );
      return null;
    }
  }

  private async buscarDefinicionWiktionaryApi(palabra: string): Promise<string | null> {
    try {
      const url = `https://es.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&format=json&titles=${encodeURIComponent(
        palabra,
      )}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'ApiLector/1.0 glosario-mvp' },
      });
      if (!resp.ok) return null;

      const data = (await resp.json()) as {
        query?: {
          pages?: Record<string, { extract?: string; missing?: string }>;
        };
      };
      const pages = data.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        if (page.missing != null) continue;
        const extract = page.extract?.trim();
        if (!extract) continue;

        const lineaUtil = extract
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 20);
        if (lineaUtil) return this.limpiarDefinicion(lineaUtil, palabra);
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Wiktionary API falló para "${palabra}": ${(error as Error)?.message ?? String(error)}`,
      );
      return null;
    }
  }

  private async buscarDefinicionDictionaryApi(palabra: string): Promise<string | null> {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(palabra)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'ApiLector/1.0 glosario-mvp' },
      });
      if (!resp.ok) return null;

      const data = (await resp.json()) as Array<{
        meanings?: Array<{
          definitions?: Array<{ definition?: string }>;
        }>;
      }>;
      for (const entry of data ?? []) {
        for (const meaning of entry.meanings ?? []) {
          for (const def of meaning.definitions ?? []) {
            const texto = def.definition?.trim();
            if (texto) return this.limpiarDefinicion(texto, palabra);
          }
        }
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `DictionaryAPI falló para "${palabra}": ${(error as Error)?.message ?? String(error)}`,
      );
      return null;
    }
  }

  private async buscarDefinicionWikipedia(palabra: string): Promise<string | null> {
    try {
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(palabra)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'ApiLector/1.0 glosario-mvp' },
      });
      if (!resp.ok) return null;

      const data = (await resp.json()) as { extract?: string };
      const extract = data.extract?.trim();
      if (!extract || extract.length < 20) return null;
      return this.limpiarDefinicion(extract, palabra);
    } catch (error) {
      this.logger.warn(
        `Wikipedia summary falló para "${palabra}": ${(error as Error)?.message ?? String(error)}`,
      );
      return null;
    }
  }

  private limpiarDefinicion(texto: string, palabra: string): string {
    const base = texto.replace(/\s+/g, ' ').trim();
    const primeraOracion = base.split(/(?<=[.!?])\s+/)[0] ?? base;
    const limpia = primeraOracion
      .replace(/en esta enciclopedia:?/gi, '')
      .replace(/puede referirse a:?/gi, '')
      .replace(/el término\s+/gi, '')
      .trim();

    if (limpia.length >= 25) return limpia.slice(0, 320);
    return `Definición breve de "${palabra}" no disponible; se detectó como término clave del segmento.`;
  }

  private generarVariantesBusqueda(palabra: string): string[] {
    const variantes = new Set<string>();
    variantes.add(palabra);

    if (palabra.endsWith('es') && palabra.length > 5) {
      variantes.add(palabra.slice(0, -2));
    }
    if (palabra.endsWith('s') && palabra.length > 4) {
      variantes.add(palabra.slice(0, -1));
    }

    if (palabra.endsWith('as') && palabra.length > 5) {
      variantes.add(`${palabra.slice(0, -2)}a`);
      variantes.add(`${palabra.slice(0, -2)}o`);
    }
    if (palabra.endsWith('os') && palabra.length > 5) {
      variantes.add(`${palabra.slice(0, -2)}o`);
      variantes.add(`${palabra.slice(0, -2)}a`);
    }

    if (palabra.endsWith('idades') && palabra.length > 8) {
      variantes.add(`${palabra.slice(0, -6)}idad`);
    }

    if (palabra === 'capitulo') {
      variantes.add('capítulo');
    }

    return [...variantes];
  }
}
