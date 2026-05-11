import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

const GROQ_MODELO_GLOSARIO = 'llama-3.1-8b-instant';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly configService: ConfigService) {}

  async testGroq(prompt?: string): Promise<{
    success: boolean;
    response?: string;
    error?: string;
    model: string;
  }> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      return {
        success: false,
        error: 'GROQ_API_KEY no está configurada en .env',
        model: GROQ_MODELO_GLOSARIO,
      };
    }

    try {
      const groq = new Groq({ apiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt || 'Di "Hola" en una sola palabra y nada más.',
          },
        ],
        model: GROQ_MODELO_GLOSARIO,
        max_tokens: 50,
      });

      const response = chatCompletion.choices[0]?.message?.content?.trim();
      return {
        success: true,
        response: response || '(sin respuesta)',
        model: GROQ_MODELO_GLOSARIO,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        model: GROQ_MODELO_GLOSARIO,
      };
    }
  }

  /**
   * Definición corta en español para glosario (último recurso si fallan diccionarios web).
   * Devuelve null si no hay API key, la palabra no aplica o hay error.
   */
  async definicionGlosario(palabra: string): Promise<string | null> {
    const limpia = palabra.trim().toLowerCase();
    if (!limpia || limpia.length > 40) return null;

    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) return null;

    try {
      const groq = new Groq({ apiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content:
              `Eres un diccionario escolar en español (México). Define en 1 o 2 frases claras la palabra «${limpia}» para un alumno de secundaria. ` +
              `Solo el texto de la definición, sin comillas ni título. ` +
              `Si no es una palabra con significado definible (ruido, nombre propio, error tipográfico), responde exactamente: NO_DISPONIBLE`,
          },
        ],
        model: GROQ_MODELO_GLOSARIO,
        max_tokens: 200,
        temperature: 0.25,
      });

      const raw = chatCompletion.choices[0]?.message?.content?.trim() ?? '';
      if (!raw || /^no_disponible$/i.test(raw.replace(/\s+/g, '_'))) {
        return null;
      }
      if (raw.toUpperCase().includes('NO_DISPONIBLE')) return null;

      const unaLinea = raw.replace(/\s+/g, ' ').trim();
      return unaLinea.slice(0, 420);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Groq glosario falló para "${limpia}": ${message}`);
      return null;
    }
  }
}
