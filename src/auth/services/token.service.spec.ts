import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { PrismaService } from '../../prisma/prisma.service';

const persona = {
  id: BigInt(1),
  correo: 'test@example.com',
  tipoPersona: 'administrador',
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, def?: string) => def ?? null),
  getOrThrow: jest.fn().mockReturnValue('super-secret-key-at-least-32-chars!!'),
};

const mockPrisma = {
  persona: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  },
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenService(
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('generateTokenPair', () => {
    it('signs access and refresh tokens', async () => {
      const result = await service.generateTokenPair(persona);
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });

    it('persists refresh token hash to DB', async () => {
      await service.generateTokenPair(persona);
      expect(mockPrisma.persona.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({ refreshTokenHash: expect.any(String) }),
        }),
      );
    });

    it('hash stored differs from raw token', async () => {
      await service.generateTokenPair(persona);
      const updateCall = mockPrisma.persona.update.mock.calls[0][0];
      expect(updateCall.data.refreshTokenHash).not.toBe('signed-token');
      expect(updateCall.data.refreshTokenHash).toHaveLength(64); // sha256 hex
    });
  });

  describe('verifyAndConsumeRefreshToken', () => {
    const validPayload = { sub: 1, tokenType: 'refresh', rememberMe: false, email: 'test@x.com', tipoPersona: 'administrador' };

    it('throws when jwt.verify throws', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('expired'); });
      await expect(service.verifyAndConsumeRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when tokenType is not refresh', async () => {
      mockJwt.verify.mockReturnValue({ ...validPayload, tokenType: 'access' });
      await expect(service.verifyAndConsumeRefreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when stored hash does not match', async () => {
      mockJwt.verify.mockReturnValue(validPayload);
      mockPrisma.persona.findUnique.mockResolvedValue({
        id: BigInt(1),
        activo: true,
        refreshTokenHash: 'different-hash',
      });
      await expect(service.verifyAndConsumeRefreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws and revokes all tokens on hash mismatch (token theft detection)', async () => {
      mockJwt.verify.mockReturnValue(validPayload);
      mockPrisma.persona.findUnique.mockResolvedValue({
        id: BigInt(1),
        activo: true,
        refreshTokenHash: 'wrong-hash',
      });
      await expect(service.verifyAndConsumeRefreshToken('any-token')).rejects.toThrow(
        UnauthorizedException,
      );
      // revokeAllTokens sets hash to null
      expect(mockPrisma.persona.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshTokenHash: null } }),
      );
    });
  });

  describe('revokeAllTokens', () => {
    it('sets refreshTokenHash to null', async () => {
      await service.revokeAllTokens(1);
      expect(mockPrisma.persona.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { refreshTokenHash: null },
      });
    });
  });
});
