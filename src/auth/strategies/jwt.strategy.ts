/**
 * ============================================
 * ESTRATEGIA: JWT Strategy
 * ============================================
 * 
 * Estrategia de Passport para validar tokens JWT.
 * Extrae el token del header Authorization y valida que sea válido.
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
    private configService: ConfigService,
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'tu-secret-key-cambiar-en-produccion'),
    });
  }

  /**
   * Valida el payload del token JWT
   * Este método se ejecuta automáticamente cuando se valida un token
   */
  async validate(payload: any) {
    const persona = await this.personaRepository.findOne({
      where: { id: payload.sub },
      relations: ['administrador', 'padre', 'alumno', 'maestro', 'maestro.escuela', 'director', 'director.escuela'],
    });

    if (!persona) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return persona;
  }
}
