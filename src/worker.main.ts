import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker/worker.module';
import { validateEnv } from './config/env.validation';
import { initOpenTelemetry } from './infra/telemetry/otel-init';

async function bootstrap(): Promise<void> {
  process.env.OTEL_SERVICE_NAME =
    process.env.OTEL_SERVICE_NAME_WORKER ?? 'api-lector-worker';
  await initOpenTelemetry();
  validateEnv();

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const log = app.get(Logger);
  log.log('Worker BullMQ iniciado (libros-import). Redis + Postgres requeridos.');

  const shutdown = async (signal: string) => {
    log.log(`${signal} recibido. Cerrando worker...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
