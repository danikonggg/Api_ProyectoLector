/**
 * ============================================
 * PUNTO DE ENTRADA DE LA APLICACIÓN
 * ============================================
 * 
 * Este archivo es el primero que se ejecuta cuando inicias la aplicación.
 * Aquí se configura todo lo necesario para que NestJS funcione correctamente.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

/**
 * Función principal que inicia la aplicación
 */
async function bootstrap() {
  // Crear la aplicación NestJS
  const app = await NestFactory.create(AppModule);

  /**
   * Log de todas las peticiones HTTP (ver si llegan GET/POST o solo OPTIONS).
   * Busca en consola: "HTTP GET /libros" vs solo "HTTP OPTIONS /libros".
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`HTTP ${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
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
   * El GET /libros nunca llegaba tras OPTIONS: el navegador bloqueaba por headers no permitidos.
   * Incluimos todos los headers habituales que el front puede enviar.
   */
  app.enableCors({
    origin: true,
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
   */
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
      'JWT-auth', // Este nombre se usa en @ApiBearerAuth('JWT-auth')
    )
    .addTag('Autenticación', 'Endpoints de login y registro')
    .addTag('Personas', 'Endpoints de registro de usuarios por roles')
    .addTag('Escuelas', 'Gestión de escuelas (solo admin)')
    .addTag('Maestros', 'Gestión de alumnos por maestros')
    .addTag('Libros', 'Carga de libros (PDF → segmentos). Solo admin.')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantener el token al recargar
    },
  });

  // Obtener el puerto desde las variables de entorno o usar 3000 por defecto
  const port = process.env.PORT || 3000;
  
  // Iniciar el servidor
  await app.listen(port);
  
  console.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
  console.log(`📚 Swagger disponible en: http://localhost:${port}/api`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
}

// Ejecutar la función bootstrap
bootstrap();
