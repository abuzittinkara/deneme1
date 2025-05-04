/**
 * JWT yapılandırması
 * Bu dosya JWT token oluşturma ve doğrulama işlemlerini içerir
 */
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { redisClient, setCache, getCache, deleteCache } from './redis';
import { User, UserDocument } from '../models/User';
import mongoose from 'mongoose';

// JWT ortam değişkenleri tipi
interface JWTEnvironment {
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  REFRESH_TOKEN_EXPIRES_IN?: string;
  NODE_ENV?: string;
  npm_package_version?: string;
}

// Ortam değişkenlerini tipli olarak tanımla
const env: JWTEnvironment = process.env as unknown as JWTEnvironment;

// JWT seçenekleri
const jwtOptions: jwt.SignOptions = {
  algorithm: 'HS256',
  expiresIn: (env.JWT_EXPIRES_IN || '1h') as any,
  issuer: 'sesli-sohbet-api',
  audience: 'sesli-sohbet-client'
};

// Refresh token seçenekleri
const refreshTokenOptions: jwt.SignOptions = {
  algorithm: 'HS256',
  expiresIn: (env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any,
  issuer: 'sesli-sohbet-api',
  audience: 'sesli-sohbet-client'
};

// JWT secret
const JWT_SECRET = env.JWT_SECRET || 'sesli-sohbet-jwt-secret-key-2025-04-24';

// Token payload tipi
export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Token yanıt tipi
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Refresh token veri tipi
interface RefreshTokenData {
  userId: string;
  username: string;
  jti: string;
}

/**
 * Access ve refresh token oluşturur
 * @param user - Kullanıcı nesnesi
 * @returns Token bilgileri
 */
export async function generateTokens(user: UserDocument | mongoose.Document): Promise<TokenResponse> {
  try {
    // Kullanıcı bilgilerini hazırla
    const userId = user._id.toString();
    const username = user instanceof mongoose.Document ?
      (user.get('username') as string) :
      ((user as unknown as UserDocument).username);
    const role = user instanceof mongoose.Document ?
      (user.get('role') as string || 'user') :
      ((user as unknown as UserDocument).role || 'user');

    const payload: TokenPayload = {
      sub: userId,
      username,
      role
    };

    // Access token oluştur
    const accessToken = jwt.sign(payload, JWT_SECRET, jwtOptions);

    // Refresh token için benzersiz ID oluştur
    const jti = crypto.randomBytes(32).toString('hex');

    // Refresh token oluştur
    const refreshToken = jwt.sign(
      { ...payload, jti },
      JWT_SECRET,
      refreshTokenOptions
    );

    // Refresh token'ı Redis'e kaydet
    const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 gün (saniye cinsinden)
    await setCache(`refresh_token:${jti}`, {
      userId,
      username,
      jti
    } as RefreshTokenData, refreshTokenTTL);

    // Kullanıcının aktif refresh token'larını takip et
    const userRefreshTokensKey = `user_refresh_tokens:${user._id}`;
    const userRefreshTokens: string[] = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens.push(jti);

    // En fazla 5 aktif refresh token olsun
    if (userRefreshTokens.length > 5) {
      const oldestTokenJti = userRefreshTokens.shift();
      if (oldestTokenJti) {
        await deleteCache(`refresh_token:${oldestTokenJti}`);
      }
    }

    await setCache(userRefreshTokensKey, userRefreshTokens, refreshTokenTTL);

    return {
      accessToken,
      refreshToken,
      expiresIn: typeof jwtOptions.expiresIn === 'string'
        ? parseInt(jwtOptions.expiresIn) || 3600
        : jwtOptions.expiresIn || 3600 // 1 saat (saniye cinsinden)
    };
  } catch (error) {
    logger.error('Token oluşturma hatası', { error: (error as Error).message });
    throw new Error(`Token oluşturma hatası: ${(error as Error).message}`);
  }
}

/**
 * JWT token'ı doğrular
 * @param token - JWT token
 * @returns Doğrulanmış token payload'ı veya null
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [jwtOptions.algorithm as jwt.Algorithm],
      issuer: jwtOptions.issuer,
      audience: jwtOptions.audience
    }) as TokenPayload;
  } catch (error) {
    logger.error('Token doğrulama hatası', { error: (error as Error).message });
    return null;
  }
}

/**
 * Refresh token ile yeni token oluşturur
 * @param refreshToken - Refresh token
 * @returns Yeni token bilgileri
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  try {
    // Refresh token'ı doğrula
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: [refreshTokenOptions.algorithm as jwt.Algorithm],
      issuer: refreshTokenOptions.issuer,
      audience: refreshTokenOptions.audience
    }) as TokenPayload;

    if (!decoded.jti) {
      throw new Error('Geçersiz refresh token: jti eksik');
    }

    // Refresh token Redis'te var mı kontrol et
    const tokenData = await getCache<RefreshTokenData>(`refresh_token:${decoded.jti}`);

    if (!tokenData) {
      throw new Error('Geçersiz refresh token');
    }

    // Kullanıcı ID'leri eşleşiyor mu kontrol et
    if (tokenData.userId !== decoded.sub) {
      throw new Error('Refresh token kullanıcı eşleşmiyor');
    }

    // Kullanıcıyı bul
    const { User } = await import('../models/User');
    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Kullanıcı aktif mi kontrol et
    const isActive = user.get('isActive');
    if (!isActive) {
      throw new Error('Kullanıcı hesabı aktif değil');
    }

    // Eski refresh token'ı sil
    await deleteCache(`refresh_token:${decoded.jti}`);

    // Kullanıcının aktif refresh token'larını güncelle
    const userRefreshTokensKey = `user_refresh_tokens:${user._id}`;
    let userRefreshTokens: string[] = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens = userRefreshTokens.filter(jti => jti !== decoded.jti);
    await setCache(userRefreshTokensKey, userRefreshTokens);

    // Yeni token oluştur
    const userDoc = await User.findById(decoded.sub).exec();
    if (!userDoc) {
      throw new Error('Kullanıcı bulunamadı');
    }
    return await generateTokens(userDoc as UserDocument);
  } catch (error) {
    logger.error('Token yenileme hatası', { error: (error as Error).message });
    throw new Error(`Token yenileme hatası: ${(error as Error).message}`);
  }
}

/**
 * Kullanıcının tüm refresh token'larını geçersiz kılar
 * @param userId - Kullanıcı ID'si
 * @returns İşlem başarılı mı
 */
export async function invalidateAllUserTokens(userId: string | mongoose.Types.ObjectId): Promise<boolean> {
  try {
    // Kullanıcının aktif refresh token'larını al
    const userRefreshTokensKey = `user_refresh_tokens:${userId}`;
    const userRefreshTokens: string[] = await getCache(userRefreshTokensKey) || [];

    // Tüm refresh token'ları sil
    for (const jti of userRefreshTokens) {
      await deleteCache(`refresh_token:${jti}`);
    }

    // Kullanıcının token listesini temizle
    await deleteCache(userRefreshTokensKey);

    return true;
  } catch (error) {
    logger.error('Token geçersiz kılma hatası', { error: (error as Error).message, userId });
    return false;
  }
}

/**
 * Belirli bir refresh token'ı geçersiz kılar
 * @param refreshToken - Refresh token
 * @returns İşlem başarılı mı
 */
export async function invalidateRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    // Refresh token'ı doğrula
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: [refreshTokenOptions.algorithm as jwt.Algorithm],
      issuer: refreshTokenOptions.issuer,
      audience: refreshTokenOptions.audience
    }) as TokenPayload;

    if (!decoded.jti || !decoded.sub) {
      throw new Error('Geçersiz refresh token: jti veya sub eksik');
    }

    // Refresh token'ı sil
    await deleteCache(`refresh_token:${decoded.jti}`);

    // Kullanıcının aktif refresh token'larını güncelle
    const userRefreshTokensKey = `user_refresh_tokens:${decoded.sub}`;
    let userRefreshTokens: string[] = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens = userRefreshTokens.filter(jti => jti !== decoded.jti);
    await setCache(userRefreshTokensKey, userRefreshTokens);

    return true;
  } catch (error) {
    logger.error('Refresh token geçersiz kılma hatası', { error: (error as Error).message });
    return false;
  }
}

export default {
  generateTokens,
  verifyToken,
  refreshAccessToken,
  invalidateAllUserTokens,
  invalidateRefreshToken
};
