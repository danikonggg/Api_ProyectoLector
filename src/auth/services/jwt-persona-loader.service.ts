import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

const RELATIONS_BY_TIPO: Record<string, Record<string, boolean>> = {
  administrador: { administrador: true },
  alumno: { alumno: true },
  director: { director: true },
  maestro: { maestro: true },
  padre: { padre: true },
};

const CACHE_PREFIX = 'lector:jwt:persona:';

export type PersonaPrincipal = {
  id: bigint;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  correo: string | null;
  tipoPersona: string | null;
  activo: boolean | null;
  ultimaConexion: Date | null;
  administrador?: unknown;
  alumno?: unknown;
  director?: unknown;
  maestro?: unknown;
  padre?: unknown;
};

@Injectable()
export class JwtPersonaLoaderService {
  private readonly ttlMs: number;
  private readonly mem = new Map<number, { persona: PersonaPrincipal; exp: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    // Default 30s. Explicit '0' disables cache. Undefined/null uses default.
    const rawTtl = this.configService.get<string>('JWT_PERSONA_CACHE_TTL_MS');
    this.ttlMs = rawTtl != null ? Number(rawTtl) : 30000;
  }

  private cacheKey(personaId: number): string {
    return `${CACHE_PREFIX}${personaId}`;
  }

  private async getCached(personaId: number): Promise<PersonaPrincipal | null> {
    if (this.ttlMs <= 0) return null;

    if (this.redis.enabled && this.redis.raw) {
      const raw = await this.redis.get(this.cacheKey(personaId));
      if (!raw) return null;
      try {
        const plain = JSON.parse(raw) as PersonaPrincipal;
        if (plain.id != null) plain.id = BigInt(plain.id as unknown as string | number);
        return plain;
      } catch {
        await this.redis.del(this.cacheKey(personaId));
        return null;
      }
    }

    const hit = this.mem.get(personaId);
    if (hit && Date.now() < hit.exp) return hit.persona;
    return null;
  }

  private async setCached(personaId: number, persona: PersonaPrincipal): Promise<void> {
    if (this.ttlMs <= 0) return;

    const payload = JSON.stringify(persona, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val,
    );
    const ttlSec = Math.max(1, Math.ceil(this.ttlMs / 1000));

    if (this.redis.enabled && this.redis.raw) {
      await this.redis.setex(this.cacheKey(personaId), ttlSec, payload);
      return;
    }

    this.mem.set(personaId, { persona, exp: Date.now() + this.ttlMs });
  }

  async loadPrincipal(personaId: number): Promise<PersonaPrincipal> {
    const cached = await this.getCached(personaId);

    // Cache hit: trust the cached value (activo/tipoPersona were valid when cached).
    // The cache TTL (30s default) bounds the staleness window.
    if (cached) {
      if (!cached.activo) {
        await this.invalidate(personaId);
        throw new UnauthorizedException('Usuario inactivo');
      }
      return cached;
    }

    // Cache miss: load from DB with role-specific include
    const authRow = await this.prisma.persona.findUnique({
      where: { id: BigInt(personaId) },
      select: { id: true, activo: true, tipoPersona: true },
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
    const include = RELATIONS_BY_TIPO[tipoDb] ?? {};

    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(personaId) },
      include: Object.keys(include).length > 0 ? include : undefined,
    });

    if (!persona) throw new UnauthorizedException('Usuario no encontrado');

    await this.setCached(personaId, persona as PersonaPrincipal);
    return persona as PersonaPrincipal;
  }

  async invalidate(personaId: number): Promise<void> {
    this.mem.delete(personaId);
    if (this.redis.enabled && this.redis.raw) {
      await this.redis.del(this.cacheKey(personaId));
    }
  }
}
