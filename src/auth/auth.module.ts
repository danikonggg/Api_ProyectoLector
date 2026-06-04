import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtPersonaLoaderService } from './services/jwt-persona-loader.service';
import { TokenService } from './services/token.service';
import { AuthorizationService } from '../common/services/authorization.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '2d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    JwtPersonaLoaderService,
    AuthorizationService,
  ],
  exports: [
    AuthService,
    TokenService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    JwtPersonaLoaderService,
    AuthorizationService,
  ],
})
export class AuthModule {}
