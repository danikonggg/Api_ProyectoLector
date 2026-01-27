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
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersonasModule } from './personas/personas.module';
import { AuthModule } from './auth/auth.module';
import { EscuelasModule } from './escuelas/escuelas.module';
import { MaestrosModule } from './maestros/maestros.module';
import { LibrosModule } from './libros/libros.module';

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
        
        // Mostrar queries SQL en consola (solo en desarrollo)
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Importar módulos de la aplicación
    AuthModule, // Módulo de autenticación JWT
    PersonasModule, // Módulo de registro de usuarios con roles
    EscuelasModule, // Módulo de gestión de escuelas
    MaestrosModule, // Gestión de alumnos por maestros
    LibrosModule, // Carga de libros (PDF → segmentos)
  ],
  
  // Controladores que manejan las rutas HTTP
  controllers: [AppController],
  
  // Servicios que contienen la lógica de negocio
  providers: [AppService],
})
export class AppModule {}
