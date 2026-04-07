import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Persona } from '../../personas/entities/persona.entity';
import { RedisService } from '../../infra/redis/redis.service';

const RELATIONS_BY_TIPO: Record<string, string[]> = {
  administrador: ['administrador'],
  alumno: ['alumno'],
  director: ['director'],
  maestro: ['maestro'],
  padre: ['padre'],
};

const CACHE_PREFIX = 'lector:jwt:persona:';

@Injectable()
export class JwtPersonaLoaderService {
  private readonly ttlMs: number;
  /** Fallback local si Redis deshabilitado */
  private readonly mem = new Map<number, { persona: Persona; exp: number }>();

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.ttlMs = Number(this.configService.get<string>('JWT_PERSONA_CACHE_TTL_MS') ?? '0') || 0;
  }

  private cacheKey(personaId: number): string {
    return `${CACHE_PREFIX}${personaId}`;
  }

  private async getCached(personaId: number): Promise<Persona | null> {
    if (this.ttlMs <= 0) return null;

    if (this.redis.enabled && this.redis.raw) {
      const raw = await this.redis.get(this.cacheKey(personaId));
      if (!raw) return null;
      try {
        const plain = JSON.parse(raw) as Record<string, unknown>;
        return plainToInstance(Persona, plain, {
          enableImplicitConversion: true,
          excludeExtraneousValues: false,
        });
      } catch {
        await this.redis.del(this.cacheKey(personaId));
        return null;
      }
    }

    const hit = this.mem.get(personaId);
    if (hit && Date.now() < hit.exp) return hit.persona;
    return null;
  }

  private async setCached(personaId: number, persona: Persona): Promise<void> {
    if (this.ttlMs <= 0) return;

    const plain = instanceToPlain(persona, { excludeExtraneousValues: false });
    const payload = JSON.stringify(plain);
    const ttlSec = Math.max(1, Math.ceil(this.ttlMs / 1000));

    if (this.redis.enabled && this.redis.raw) {
      await this.redis.setex(this.cacheKey(personaId), ttlSec, payload);
      return;
    }

    this.mem.set(personaId, { persona, exp: Date.now() + this.ttlMs });
  }

  async loadPrincipal(personaId: number): Promise<Persona> {
    const cached = await this.getCached(personaId);

    /** Siempre comprobar activo/tipo en BD antes de devolver cache (evita usuario desactivado con JWT válido). */
    const authRow = await this.personaRepository.findOne({
      where: { id: personaId },
      select: ['id', 'activo', 'tipoPersona'],
    });

    if (!authRow) {
      await this.invalidate(personaId);
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!authRow.activo) {
      await this.invalidate(personaId);
      throw new UnauthorizedException('Usuario inactivo');
    }

    const tipoDb = (authRow.tipoPersona ?? '').trim();
    if (cached) {
      const tipoCached = (cached.tipoPersona ?? '').trim();
      if (tipoDb === tipoCached) {
        return cached;
      }
      await this.invalidate(personaId);
    }

    const relations = RELATIONS_BY_TIPO[tipoDb] ?? [];

    const persona = await this.personaRepository.findOne({
      where: { id: personaId },
      relations: relations.length ? relations : [],
    });

    if (!persona) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    await this.setCached(personaId, persona);
    return persona;
  }

  async invalidate(personaId: number): Promise<void> {
    this.mem.delete(personaId);
    if (this.redis.enabled && this.redis.raw) {
      await this.redis.del(this.cacheKey(personaId));
    }
  }
}
