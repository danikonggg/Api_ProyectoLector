import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';
import pino from 'pino';

export type BuildLoggerParamsOptions = {
  /** false = sin logs de request HTTP (p. ej. worker) */
  http?: boolean;
};

/**
 * Pino + pino-http: HTTP en una línea (método ruta status tiempo) y opción de copiar todo a LOG_FILE.
 */
export function buildLoggerParams(
  config: ConfigService,
  opts: BuildLoggerParamsOptions = {},
): Params {
  const enableHttp = opts.http !== false;
  const level = config.get<string>('LOG_LEVEL', 'info');
  const logFile = config.get<string>('LOG_FILE')?.trim();
  const httpSummary = config.get<string>('LOG_HTTP_SUMMARY', 'true') !== 'false';
  const autoLog =
    enableHttp && config.get<string>('HTTP_AUTO_LOGGING', 'true') !== 'false';

  const streams: pino.StreamEntry[] = [
    { level: level as pino.Level, stream: process.stdout },
  ];
  if (logFile) {
    const dir = dirname(logFile);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    streams.push({
      level: level as pino.Level,
      stream: pino.destination({ dest: logFile, sync: false }),
    });
  }

  const rootLogger = logFile
    ? pino({ level }, pino.multistream(streams))
    : pino({ level }, process.stdout);

  const pinoHttp: Options = {
    level,
    logger: rootLogger,
    autoLogging: autoLog
      ? {
          ignore: (req) => {
            const url = (req as { originalUrl?: string }).originalUrl ?? req.url ?? '';
            const pathOnly = url.split('?')[0] ?? '';
            return pathOnly === '/health';
          },
        }
      : false,
    customProps: (req) => ({
      correlationId: (req as { correlationId?: string }).correlationId,
    }),
  };

  if (httpSummary && enableHttp) {
    pinoHttp.customSuccessMessage = (req, res, responseTime) => {
      const url = (req as { originalUrl?: string }).originalUrl ?? req.url ?? '';
      const pathOnly = url.split('?')[0] ?? url;
      return `${req.method} ${pathOnly} ${res.statusCode} ${responseTime.toFixed(0)}ms`;
    };
    pinoHttp.customErrorMessage = (req, res, err) => {
      const url = (req as { originalUrl?: string }).originalUrl ?? req.url ?? '';
      const pathOnly = url.split('?')[0] ?? url;
      return `${req.method} ${pathOnly} ${res.statusCode} ${err.message}`;
    };
    pinoHttp.serializers = {
      req: (req) => ({
        method: req.method,
        url: (req as { originalUrl?: string }).originalUrl ?? req.url,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
      err: pino.stdSerializers.err,
    };
  }

  return { pinoHttp };
}
