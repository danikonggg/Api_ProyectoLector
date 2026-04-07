import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { initOpenTelemetry } from './infra/telemetry/otel-init';
import './infra/telemetry/prometheus-metrics';

/** Límite de tamaño del body para evitar payloads enormes (DoS) */
const BODY_LIMIT = '1mb';

async function bootstrap() {
  await initOpenTelemetry();
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  const origin =
    corsOrigins && process.env.NODE_ENV === 'production'
      ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      : true;

  app.enableCors({
    origin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Accept-Language',
      'Origin',
      'X-Requested-With',
      'x-request-id',
      'x-correlation-id',
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    preflightContinue: false,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API Lector - Sistema Educativo')
      .setDescription('API REST para sistema educativo con registro de usuarios, roles y autenticación JWT')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Ingresa el token JWT',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Público', 'Sin token: login, health')
      .addTag('Cualquier autenticado', 'Cualquier rol con JWT: perfil')
      .addTag('Solo Administrador', 'Dashboard, escuelas, libros (cargar/eliminar/PDF), personas (padres, directores, admins), auditoría, otorgar/canjear por :id')
      .addTag('Solo Director', 'Dashboard y libros de mi escuela (sin enviar id): GET/POST /director/libros, /director/canjear-libro')
      .addTag('Solo Maestro', 'Mis alumnos: listar, ver, asignar, desasignar')
      .addTag('Solo Alumno', 'Libros de mi escuela: GET /escuelas/mis-libros')
      .addTag('Admin o Director', 'Registro alumno/maestro, listar alumnos/buscar, ver escuela, maestros y alumnos de una escuela')
      .addTag('Admin, Director o Alumno', 'Ver detalle de un libro: GET /libros/:id')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const nestLogger = app.get(Logger);
  const shutdown = async (signal: string) => {
    nestLogger.log(`${signal} recibido. Cerrando...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  nestLogger.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    nestLogger.log(`📚 Swagger disponible en: http://localhost:${port}/api`);
  }
  nestLogger.log(`🏥 Health check: http://localhost:${port}/health`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar la aplicación:', err);
  process.exit(1);
});
