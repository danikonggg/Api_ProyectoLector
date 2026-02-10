/**
 * Logger personalizado para TypeORM.
 * Muestra las queries de forma compacta y legible, sin volcar SQL gigante en consola.
 */

import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';

const MAX_QUERY_LENGTH = 120;
const DB_LOG = '[DB]';

export class TypeOrmLoggerService {
  private readonly logger = new Logger('TypeORM');

  /**
   * Trunca y limpia el SQL para que sea legible en una línea.
   */
  private formatQuery(query: string): string {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= MAX_QUERY_LENGTH) return cleaned;
    return cleaned.slice(0, MAX_QUERY_LENGTH) + '...';
  }

  logQuery(query: string, _parameters?: unknown[], _queryRunner?: QueryRunner): void {
    this.logger.log(`${DB_LOG} ${this.formatQuery(query)}`);
  }

  logQueryError(
    error: string | Error,
    query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`${DB_LOG} ERROR: ${msg}`);
    this.logger.error(`${DB_LOG} Query: ${this.formatQuery(query)}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    this.logger.warn(`${DB_LOG} SLOW (${time}ms): ${this.formatQuery(query)}`);
  }

  log(
    level: 'log' | 'info' | 'warn',
    message: unknown,
    _queryRunner?: QueryRunner,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    if (level === 'warn') this.logger.warn(`${DB_LOG} ${msg}`);
    else if (level === 'info') this.logger.log(`${DB_LOG} ${msg}`);
    else this.logger.log(`${DB_LOG} ${msg}`);
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    this.logger.log(`${DB_LOG} Schema: ${message}`);
  }

  logMigration(message: string, _queryRunner?: QueryRunner): void {
    this.logger.log(`${DB_LOG} Migration: ${message}`);
  }
}
