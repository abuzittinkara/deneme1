/**
 * src/__tests__/utils/jwt.test.ts
 * JWT yardımcı fonksiyonları için testler
 */
import jwt from 'jsonwebtoken';
import {
  generateToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
  getTokenExpiration,
  parseExpiresIn,
} from '../../utils/jwt';
import { AuthError } from '../../middleware/authMiddleware';

// Mock env değişkenleri
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('JWT Utils', () => {
  const testPayload = {
    id: '123456789',
    username: 'testuser',
    role: 'user',
    sub: '123456789',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Token'ı doğrula
      const decoded = jwt.verify(token, 'test-jwt-secret') as any;
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.iss).toBe('fisqos-api');
      expect(decoded.aud).toBe('fisqos-client');
      expect(decoded.jti).toBeDefined();
    });

    it('should use the provided expiration time', () => {
      const token = generateToken(testPayload, '1h');
      const decoded = jwt.verify(token, 'test-jwt-secret') as any;

      // 1 saat sonrası için exp değeri kontrol et (±5 saniye tolerans)
      const expectedExp = Math.floor(Date.now() / 1000) + 3600;
      expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
      expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Token'ı doğrula
      const decoded = jwt.verify(token, 'test-jwt-refresh-secret') as any;
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.type).toBe('refresh');
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = generateTokenPair(testPayload);

      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeDefined();
      expect(tokenPair.refreshExpiresIn).toBeDefined();

      // Access token'ı doğrula
      const decodedAccess = jwt.verify(tokenPair.accessToken, 'test-jwt-secret') as any;
      expect(decodedAccess.id).toBe(testPayload.id);

      // Refresh token'ı doğrula
      const decodedRefresh = jwt.verify(tokenPair.refreshToken, 'test-jwt-refresh-secret') as any;
      expect(decodedRefresh.id).toBe(testPayload.id);
      expect(decodedRefresh.type).toBe('refresh');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = generateToken(testPayload);
      const decoded = await verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should reject an invalid token', async () => {
      await expect(verifyToken('invalid-token')).rejects.toThrow(AuthError);
    });

    it('should reject an expired token', async () => {
      // Süresi dolmuş token oluştur
      const expiredToken = jwt.sign(
        { ...testPayload, exp: Math.floor(Date.now() / 1000) - 10 },
        'test-jwt-secret'
      );

      await expect(verifyToken(expiredToken)).rejects.toThrow(AuthError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = generateRefreshToken(testPayload);
      const decoded = await verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should reject a token with missing type field', async () => {
      // type alanı olmayan token oluştur
      const invalidToken = jwt.sign(testPayload, 'test-jwt-refresh-secret');

      await expect(verifyRefreshToken(invalidToken)).rejects.toThrow(AuthError);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return the remaining time for a valid token', async () => {
      // 1 saat geçerli token oluştur
      const token = generateToken(testPayload, '1h');
      const expiresIn = await getTokenExpiration(token);

      // 1 saat = 3600 saniye (±5 saniye tolerans)
      expect(expiresIn).toBeGreaterThan(3595);
      expect(expiresIn).toBeLessThan(3605);
    });

    it('should reject an invalid token', async () => {
      await expect(getTokenExpiration('invalid-token')).rejects.toThrow(AuthError);
    });
  });

  describe('parseExpiresIn', () => {
    it('should parse seconds correctly', () => {
      expect(parseExpiresIn('30s')).toBe(30 * 1000);
    });

    it('should parse minutes correctly', () => {
      expect(parseExpiresIn('15m')).toBe(15 * 60 * 1000);
    });

    it('should parse hours correctly', () => {
      expect(parseExpiresIn('2h')).toBe(2 * 60 * 60 * 1000);
    });

    it('should parse days correctly', () => {
      expect(parseExpiresIn('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should parse weeks correctly', () => {
      expect(parseExpiresIn('2w')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    });

    it('should parse years correctly', () => {
      expect(parseExpiresIn('1y')).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it('should handle numeric input', () => {
      expect(parseExpiresIn(60)).toBe(60 * 1000);
    });

    it('should return default value for invalid format', () => {
      expect(parseExpiresIn('invalid')).toBe(900000); // 15 dakika
    });
  });
});
