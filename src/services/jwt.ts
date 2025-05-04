/**
 * src/services/jwt.ts
 * JWT token servisi
 */
import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/User';
import { logger } from '../utils/logger';

// JWT yapılandırması
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Token payload tipi
export interface TokenPayload {
  id: string;
  username: string;
  role?: string;
}

// Decoded token tipi
export interface DecodedToken {
  id: string;
  username: string;
  role?: string;
  iat: number;
  exp: number;
}

/**
 * Access token oluşturma
 * @param user - Kullanıcı dokümanı
 * @returns JWT token
 */
export const generateAccessToken = (user: UserDocument): string => {
  try {
    return jwt.sign(
      { 
        id: user._id.toString(),
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  } catch (error) {
    logger.error('Access token oluşturma hatası:', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw new Error('Token oluşturma hatası');
  }
};

/**
 * Refresh token oluşturma
 * @param user - Kullanıcı dokümanı
 * @returns JWT refresh token
 */
export const generateRefreshToken = (user: UserDocument): string => {
  try {
    return jwt.sign(
      { 
        id: user._id.toString(),
        username: user.username
      },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
  } catch (error) {
    logger.error('Refresh token oluşturma hatası:', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw new Error('Refresh token oluşturma hatası');
  }
};

/**
 * Token doğrulama
 * @param token - JWT token
 * @returns Decoded token veya null
 */
export const verifyToken = (token: string): DecodedToken | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
  } catch (error) {
    logger.error('Token doğrulama hatası:', {
      error: (error as Error).message,
      token: token.substring(0, 10) + '...'
    });
    return null;
  }
};

/**
 * Refresh token doğrulama
 * @param token - JWT refresh token
 * @returns Decoded token veya null
 */
export const verifyRefreshToken = (token: string): DecodedToken | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as DecodedToken;
  } catch (error) {
    logger.error('Refresh token doğrulama hatası:', {
      error: (error as Error).message,
      token: token.substring(0, 10) + '...'
    });
    return null;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};
