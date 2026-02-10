/**
 * ============================================
 * MÓDULO PRINCIPAL DE LA APLICACIÓN
 * ============================================
 * 
 * Este es el módulo raíz que importa y configura todos los demás módulos.
 * Aquí se configura:
 * - Variables de entorno (.env)
 * - Conexión a PostgreSQL con TypeORM
 * - Todos los módulos de la aplicación
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersonasModule } from './personas/personas.module';
import { AuthModule } from './auth/auth.module';
import { EscuelasModule } from './escuelas/escuelas.module';
import { MaestrosModule } from './maestros/maestros.module';
import { LibrosModule } from './libros/libros.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DirectorModule } from './director/director.module';
import { TypeOrmLoggerService } from './common/database/typeorm-logger.service';

@Module({
  imports: [
    /**
     * Configuración de variables de entorno
     * - isGlobal: Hace que ConfigModule esté disponible en toda la app
     * - envFilePath: Indica dónde está el archivo .env
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 100, // 100 peticiones por minuto por IP
      },
    ]),

    /**
     * Configuración de TypeORM para PostgreSQL
     * - forRootAsync: Carga la configuración de forma asíncrona
     * - useFactory: Función que crea la configuración usando ConfigService
     */
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Tipo de base de datos
        type: 'postgres',
        
        // Credenciales de conexión (desde .env)
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'api_lector'),
        
        // Buscar todas las entidades en la carpeta src
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        
        // Sincronizar esquema automáticamente
        // ⚠️ DESACTIVADO: Ya tienes tablas existentes con estructura diferente
        // Usa migraciones de TypeORM para cambios controlados
        synchronize: false,
        
        // Logging: solo en desarrollo y si DB_LOG_QUERIES=true
        // - true: queries truncadas (120 chars) + errores
        // - false: solo errores (menos ruido en consola)
        logging:
          configService.get('NODE_ENV') === 'development'
            ? configService.get('DB_LOG_QUERIES', 'true') === 'true'
              ? ['query', 'error']
              : ['error']
            : false,
        logger: new TypeOrmLoggerService(),
        maxQueryExecutionTime: 2000, // Log queries lentas (>2s)
      }),
      inject: [ConfigService],
    }),

    // Importar módulos de la aplicación
    AuthModule, // Módulo de autenticación JWT
    PersonasModule, // Módulo de registro de usuarios con roles
    EscuelasModule, // Módulo de gestión de escuelas
    MaestrosModule, // Gestión de alumnos por maestros
    LibrosModule, // Carga de libros (PDF → segmentos)
    AuditModule, // Auditoría de acciones sensibles (solo admin)
    AdminModule, // Dashboard y endpoints exclusivos para administradores
    DirectorModule, // Dashboard para directores de escuela
  ],
  
  // Controladores que manejan las rutas HTTP
  controllers: [AppController],

  // Servicios que contienen la lógica de negocio
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
