/**
 * ============================================
 * PUNTO DE ENTRADA DE LA APLICACIÓN
 * ============================================
 *
 * Este archivo es el primero que se ejecuta cuando inicias la aplicación.
 * Aquí se configura todo lo necesario para que NestJS funcione correctamente.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/**
 * Función principal que inicia la aplicación
 */
async function bootstrap() {
  validateEnv();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  /**
   * Log de todas las peticiones HTTP (ver si llegan GET/POST o solo OPTIONS).
   * Busca en consola: "HTTP GET /libros" vs solo "HTTP OPTIONS /libros".
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.log(`HTTP ${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  /**
   * Configurar validación global de datos
   * - whitelist: Elimina propiedades que no están en el DTO
   * - forbidNonWhitelisted: Rechaza la petición si hay propiedades extra
   * - transform: Convierte automáticamente los tipos de datos
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * Habilitar CORS (Cross-Origin Resource Sharing)
   * En producción: usar CORS_ORIGINS (separados por coma).
   * En desarrollo: permitir todo (origin: true) si CORS_ORIGINS está vacío.
   */
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
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    preflightContinue: false,
  });

  /**
   * Configurar Swagger (Documentación de API)
   * Desactivado en producción por seguridad.
   */
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

  // Obtener el puerto desde las variables de entorno o usar 3000 por defecto
  const port = process.env.PORT || 3000;

  // Iniciar el servidor
  await app.listen(port);

  logger.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger disponible en: http://localhost:${port}/api`);
  }
  logger.log(`🏥 Health check: http://localhost:${port}/health`);
}

// Ejecutar la función bootstrap
bootstrap();
