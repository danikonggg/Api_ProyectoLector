/**
 * ============================================
 * ESTRATEGIA: JWT Strategy
 * ============================================
 * Valida tokens JWT y verifica que el usuario exista y esté activo.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from '../../personas/entities/persona.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
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

  async validate(payload: { sub: number }) {
    const persona = await this.personaRepository.findOne({
      where: { id: payload.sub },
      relations: ['administrador', 'padre', 'alumno', 'maestro', 'maestro.escuela', 'director', 'director.escuela'],
    });

    if (!persona) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!persona.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return persona;
  }
}
