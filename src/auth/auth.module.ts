/**
 * ============================================
 * MÓDULO: AuthModule
 * ============================================
 * 
 * Módulo de autenticación con JWT.
 * Configura Passport y JWT strategy.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Persona } from '../personas/entities/persona.entity';
import { Administrador } from '../personas/entities/administrador.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'tu-secret-key-cambiar-en-produccion'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Persona, Administrador]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
