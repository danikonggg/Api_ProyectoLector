import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type TokenPayload = {
  sub: number;
  email?: string;
  tipoPersona?: string;
};

type RefreshPayload = TokenPayload & {
  tokenType: 'refresh';
  rememberMe: boolean;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET')?.trim() ||
      this.configService.getOrThrow<string>('JWT_SECRET')
    );
  }

  private getAccessTtl(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '2d');
  }

  private getRefreshTtl(rememberMe: boolean): string {
    return rememberMe
      ? this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '50d')
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN_SHORT', '2d');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokenPair(
    persona: { id: bigint; correo: string | null; tipoPersona: string | null },
    rememberMe = false,
  ) {
    const payload: TokenPayload = {
      sub: Number(persona.id),
      email: persona.correo ?? undefined,
      tipoPersona: persona.tipoPersona ?? undefined,
    };

    const refreshTtl = this.getRefreshTtl(rememberMe);

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.getAccessTtl(),
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenType: 'refresh', rememberMe } satisfies RefreshPayload,
      { secret: this.getRefreshSecret(), expiresIn: refreshTtl },
    );

    // Persist hash so this token can be revoked
    await this.prisma.persona.update({
      where: { id: persona.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.getAccessTtl(),
      refreshExpiresIn: refreshTtl,
      rememberMe,
    };
  }

  /**
   * Verifies the refresh token signature AND checks it hasn't been rotated away.
   * Throws UnauthorizedException if invalid, expired, or already rotated.
   */
  async verifyAndConsumeRefreshToken(
    refreshToken: string,
  ): Promise<RefreshPayload & { storedPersonaId: number }> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.tokenType !== 'refresh' || payload.sub == null) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Verify the stored hash matches — prevents token reuse after rotation
    const persona = await this.prisma.persona.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, refreshTokenHash: true, activo: true },
    });

    if (!persona || !persona.activo) {
      throw new UnauthorizedException('Usuario no autorizado para refrescar sesión');
    }

    const incomingHash = this.hashToken(refreshToken);
    if (!persona.refreshTokenHash || persona.refreshTokenHash !== incomingHash) {
      // Token was already rotated or manually revoked — potential token theft
      // Invalidate all sessions as a precaution
      await this.revokeAllTokens(Number(persona.id));
      throw new UnauthorizedException('Refresh token ya fue utilizado o revocado');
    }

    return { ...payload, storedPersonaId: Number(persona.id) };
  }

  async revokeAllTokens(personaId: number): Promise<void> {
    await this.prisma.persona.update({
      where: { id: BigInt(personaId) },
      data: { refreshTokenHash: null },
    });
  }
}
