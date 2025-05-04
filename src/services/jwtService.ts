/**
 * src/services/jwtService.ts
 * JWT (JSON Web Token) servisi
 */
import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/User';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * JWT payload arayüzü
 */
export interface JwtPayload {
  id: string;
  username?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Access token oluşturma
 *
 * @param user - Kullanıcı dokümanı
 * @returns JWT access token
 */
export const generateAccessToken = (user: UserDocument): string => {
  const payload: JwtPayload = {
    id: user._id.toString(),
    username: user.username,
    role: user.role
  };

  try {
    // JWT_SECRET'ın string olduğundan emin ol
    const secret = env.JWT_SECRET as string;

    // JWT_EXPIRES_IN'in string veya number olduğundan emin ol
    const expiresIn = env.JWT_EXPIRES_IN as string | number;

    // TypeScript ile uyumlu hale getir
    return jwt.sign(
      payload,
      secret,
      { expiresIn: expiresIn } as jwt.SignOptions
    );
  } catch (error) {
    logger.error('Access token oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId: user._id
    });
    throw new Error('Token oluşturulamadı');
  }
};

/**
 * Refresh token oluşturma
 *
 * @param user - Kullanıcı dokümanı
 * @returns JWT refresh token
 */
export const generateRefreshToken = (user: UserDocument): string => {
  const payload: JwtPayload = {
    id: user._id.toString()
  };

  try {
    // JWT_REFRESH_SECRET'ın string olduğundan emin ol
    const secret = env.JWT_REFRESH_SECRET as string;

    // JWT_REFRESH_EXPIRES_IN'in string veya number olduğundan emin ol
    const expiresIn = env.JWT_REFRESH_EXPIRES_IN as string | number;

    // TypeScript ile uyumlu hale getir
    return jwt.sign(
      payload,
      secret,
      { expiresIn: expiresIn } as jwt.SignOptions
    );
  } catch (error) {
    logger.error('Refresh token oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId: user._id
    });
    throw new Error('Refresh token oluşturulamadı');
  }
};

/**
 * Access token doğrulama
 *
 * @param token - JWT access token
 * @returns Doğrulanmış payload veya null
 */
export const verifyAccessToken = (token: string): JwtPayload | null => {
  try {
    // JWT_SECRET'ın string olduğundan emin ol
    const secret = env.JWT_SECRET as string;

    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    logger.debug('Access token doğrulama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
    return null;
  }
};

/**
 * Refresh token doğrulama
 *
 * @param token - JWT refresh token
 * @returns Doğrulanmış payload veya null
 */
export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    // JWT_REFRESH_SECRET'ın string olduğundan emin ol
    const secret = env.JWT_REFRESH_SECRET as string;

    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    logger.debug('Refresh token doğrulama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
    return null;
  }
};

/**
 * Token'ın sona erme süresini hesapla
 *
 * @param token - JWT token
 * @returns Sona erme süresi (saniye) veya null
 */
export const getTokenExpiration = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    if (!decoded || !decoded.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now;
  } catch (error) {
    logger.debug('Token sona erme süresi hesaplama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
    return null;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpiration
};
