import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Groq from 'groq-sdk';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  getHello(): string {
    return '¡Bienvenido a la API, TEAM VL!';
  }enton

  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    message: string;
    timestamp: string;
    database?: 'connected' | 'disconnected';
  }> {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      // DB no disponible
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      message:
        dbStatus === 'connected'
          ? 'API funcionando correctamente'
          : 'API funcionando pero la base de datos no está disponible',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  }

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
