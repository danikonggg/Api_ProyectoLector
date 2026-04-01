import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
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
        model: 'llama-3.1-8b-instant',
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
        model: 'llama-3.1-8b-instant',
        max_tokens: 50,
      });

      const response = chatCompletion.choices[0]?.message?.content?.trim();
      return {
        success: true,
        response: response || '(sin respuesta)',
        model: 'llama-3.1-8b-instant',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        model: 'llama-3.1-8b-instant',
      };
    }
  }
}
