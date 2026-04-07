/**
 * JWT: valida firma y delega la carga de Persona a JwtPersonaLoaderService
 * (una relación por rol, sin maestro+director+alumno+padre+admin a la vez).
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Persona } from '../../personas/entities/persona.entity';
import { JwtPersonaLoaderService } from '../services/jwt-persona-loader.service';

export type AccessTokenPayload = {
  sub: number;
  email?: string;
  tipoPersona?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly jwtPersonaLoader: JwtPersonaLoaderService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres. Revisa tu .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<Persona> {
    if (payload?.sub == null) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.jwtPersonaLoader.loadPrincipal(Number(payload.sub));
  }
}
