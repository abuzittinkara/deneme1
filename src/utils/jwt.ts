/**
 * src/utils/jwt.ts
 * JWT işlemleri için yardımcı fonksiyonlar
 */
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { AuthError } from '../middleware/authMiddleware';
import { env } from '../config/env';
import { randomBytes } from 'crypto';

/**
 * JWT payload tipi
 */
export interface JwtPayload {
  id: string;
  username: string;
  role: string;
  status?: string;
  email?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  iss?: string;
  aud?: string;
  sub: string;
}

/**
 * Token çifti
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * JWT token oluşturur
 * @param payload Token içeriği
 * @param expiresIn Geçerlilik süresi
 * @returns JWT token
 */
export function generateToken(payload: JwtPayload, expiresIn = env.JWT_EXPIRES_IN): string {
  try {
    // JWT_SECRET'ın string olduğundan emin ol
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET ortam değişkeni tanımlanmamış');
    }

    const secret = env.JWT_SECRET;

    // expiresIn'in string veya number olduğundan emin ol
    const expiration =
      typeof expiresIn === 'string' || typeof expiresIn === 'number'
        ? expiresIn
        : env.JWT_EXPIRES_IN;

    // Benzersiz token ID'si oluştur (CSRF koruması için)
    const jti = randomBytes(32).toString('hex');

    // Şu anki zaman (saniye cinsinden)
    const now = Math.floor(Date.now() / 1000);

    // Payload'ı hazırla
    const tokenPayload = {
      ...payload,
      jti, // Benzersiz token ID'si
      iss: 'fisqos-api', // Token veren
      aud: 'fisqos-client', // Hedef kitle
      sub: payload.id, // Konu (kullanıcı ID)
      iat: now, // Oluşturulma zamanı
      nbf: now, // Bu zamandan önce geçerli değil
      type: 'access', // Token tipi
    };

    // TypeScript ile uyumlu hale getir
    const options: jwt.SignOptions = {
      expiresIn: expiration as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
      notBefore: 0, // Hemen geçerli
    };

    return jwt.sign(tokenPayload, secret, options);
  } catch (error) {
    logger.error('JWT token oluşturma hatası', {
      error: (error as Error).message,
      userId: payload.id,
    });
    throw error;
  }
}

/**
 * Yenileme token'ı oluşturur
 * @param payload Token içeriği
 * @param expiresIn Geçerlilik süresi
 * @returns Yenileme token'ı
 */
export function generateRefreshToken(
  payload: JwtPayload,
  expiresIn = env.JWT_REFRESH_EXPIRES_IN
): string {
  try {
    // JWT_REFRESH_SECRET'ın string olduğundan emin ol
    if (!env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET ortam değişkeni tanımlanmamış');
    }

    const secret = env.JWT_REFRESH_SECRET;

    // expiresIn'in string veya number olduğundan emin ol
    const expiration =
      typeof expiresIn === 'string' || typeof expiresIn === 'number'
        ? expiresIn
        : env.JWT_REFRESH_EXPIRES_IN;

    // Benzersiz token ID'si oluştur
    const jti = randomBytes(32).toString('hex');

    // Payload'ı hazırla - refresh token için minimum bilgi
    const tokenPayload = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      jti,
      sub: payload.id,
      type: 'refresh',
    };

    // TypeScript ile uyumlu hale getir
    const options: jwt.SignOptions = {
      expiresIn: expiration as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    };

    return jwt.sign(tokenPayload, secret, options);
  } catch (error) {
    logger.error('JWT yenileme token\'ı oluşturma hatası', {
      error: (error as Error).message,
      userId: payload.id,
    });
    throw error;
  }
}

/**
 * Token çifti oluşturur (access token ve refresh token)
 * @param payload Token içeriği
 * @returns Token çifti
 */
export function generateTokenPair(payload: JwtPayload): TokenPair {
  try {
    // Milisaniye cinsinden geçerlilik sürelerini hesapla
    const accessTokenExpiresIn = parseExpiresIn(env.JWT_EXPIRES_IN);
    const refreshTokenExpiresIn = parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN);

    // Token'ları oluştur
    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiresIn,
      refreshExpiresIn: refreshTokenExpiresIn,
    };
  } catch (error) {
    logger.error('Token çifti oluşturma hatası', {
      error: (error as Error).message,
      userId: payload.id,
    });
    throw error;
  }
}

/**
 * ExpiresIn değerini milisaniye cinsinden hesaplar
 * @param expiresIn - Geçerlilik süresi (örn: '15m', '1h', '7d')
 * @returns Milisaniye cinsinden geçerlilik süresi
 */
function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn * 1000; // Saniyeyi milisaniyeye çevir
  }

  const match = expiresIn.match(/^(\d+)([smhdwy])$/);
  if (!match) {
    return 900000; // Varsayılan: 15 dakika
  }

  const value = match && match[1] ? parseInt(match[1], 10) : 0;
  const unit = match[2];

  switch (unit) {
    case 's':
    return value * 1000; // saniye
    case 'm':
    return value * 60 * 1000; // dakika
    case 'h':
    return value * 60 * 60 * 1000; // saat
    case 'd':
    return value * 24 * 60 * 60 * 1000; // gün
    case 'w':
    return value * 7 * 24 * 60 * 60 * 1000; // hafta
    case 'y':
    return value * 365 * 24 * 60 * 60 * 1000; // yıl
    default:
    return 900000; // Varsayılan: 15 dakika
  }
}

/**
 * JWT token'ı doğrular
 * @param token JWT token
 * @param options Doğrulama seçenekleri
 * @returns Token içeriği
 */
export function verifyToken(
  token: string,
  options: {
    audience?: string;
    issuer?: string;
    ignoreExpiration?: boolean;
    clockTolerance?: number;
  } = {}
): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    try {
      // JWT_SECRET'ın string olduğundan emin ol
      if (!env.JWT_SECRET) {
        throw new AuthError('JWT_SECRET ortam değişkeni tanımlanmamış', 500, 'SERVER_ERROR');
      }

      const secret = env.JWT_SECRET;

      // Doğrulama seçenekleri
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['HS256'], // Sadece HS256 algoritmasını kabul et
        audience: options.audience || 'fisqos-client', // Hedef kitle kontrolü
        issuer: options.issuer || 'fisqos-api', // Token veren kontrolü
        ignoreExpiration: options.ignoreExpiration || false, // Süre kontrolü
        clockTolerance: options.clockTolerance || 30, // Saat toleransı (saniye)
      };

      jwt.verify(token, secret, verifyOptions, (err, decoded) => {
        if (err) {
          logger.warn('JWT token doğrulama hatası', {
            error: err.message,
            name: err.name,
            token: token.substring(0, 10) + '...',
          });

          if (err.name === 'TokenExpiredError') {
            reject(new AuthError('Token süresi doldu', 401, 'TOKEN_EXPIRED'));
          } else if (err.name === 'JsonWebTokenError') {
            reject(new AuthError('Geçersiz token', 401, 'INVALID_TOKEN'));
          } else if (err.name === 'NotBeforeError') {
            reject(new AuthError('Token henüz geçerli değil', 401, 'TOKEN_NOT_ACTIVE'));
          } else {
            reject(new AuthError('Token doğrulama hatası', 401, 'TOKEN_VERIFICATION_ERROR'));
          }
        } else {
          // Payload'ı doğrula
          const payload = decoded as JwtPayload;

          // Zorunlu alanları kontrol et
          if (!payload.id || !payload.username || !payload.role || !payload.sub) {
            reject(new AuthError('Geçersiz token içeriği', 401, 'INVALID_TOKEN_PAYLOAD'));
            return;
          }

          // Token tipini kontrol et
          if ((payload as any).type !== 'access') {
            reject(new AuthError('Geçersiz token tipi', 401, 'INVALID_TOKEN_TYPE'));
            return;
          }

          // Konu (sub) ile kullanıcı ID'sinin eşleştiğini kontrol et
          if (payload.sub !== payload.id) {
            reject(new AuthError('Token içeriği tutarsız', 401, 'INCONSISTENT_TOKEN_PAYLOAD'));
            return;
          }

          // Oluşturulma zamanını kontrol et
          if (!payload.iat) {
            reject(new AuthError('Token oluşturulma zamanı eksik', 401, 'INVALID_TOKEN_IAT'));
            return;
          }

          // Geçerlilik zamanını kontrol et
          if (!payload.exp) {
            reject(new AuthError('Token geçerlilik zamanı eksik', 401, 'INVALID_TOKEN_EXP'));
            return;
          }

          // Benzersiz token ID'sini kontrol et
          if (!payload.jti) {
            reject(new AuthError('Token ID eksik', 401, 'INVALID_TOKEN_JTI'));
            return;
          }

          // Tüm kontroller başarılı, payload'ı döndür
          resolve(payload);
        }
      });
    } catch (error) {
      logger.error('Token doğrulama hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });

      reject(new AuthError('Token doğrulama hatası', 401, 'TOKEN_VERIFICATION_ERROR'));
    }
  });
}

/**
 * Yenileme token'ını doğrular
 * @param token Yenileme token'ı
 * @returns Token içeriği
 */
export function verifyRefreshToken(token: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    try {
      // JWT_REFRESH_SECRET'ın string olduğundan emin ol
      if (!env.JWT_REFRESH_SECRET) {
        throw new AuthError(
          'JWT_REFRESH_SECRET ortam değişkeni tanımlanmamış',
          500,
          'SERVER_ERROR'
        );
      }

      const secret = env.JWT_REFRESH_SECRET;

      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          logger.warn('JWT yenileme token\'ı doğrulama hatası', {
            error: err.message,
            token: token.substring(0, 10) + '...',
          });

          if (err.name === 'TokenExpiredError') {
            reject(new AuthError('Yenileme token\'ı süresi doldu', 401, 'REFRESH_TOKEN_EXPIRED'));
          } else if (err.name === 'JsonWebTokenError') {
            reject(new AuthError('Geçersiz yenileme token\'ı', 401, 'INVALID_REFRESH_TOKEN'));
          } else {
            reject(
              new AuthError(
                'Yenileme token\'ı doğrulama hatası',
                401,
                'REFRESH_TOKEN_VERIFICATION_ERROR'
              )
            );
          }
        } else {
          // Payload'ı doğrula
          const payload = decoded as JwtPayload;

          if (!payload.id || !payload.username || !payload.role || !payload.sub) {
            reject(
              new AuthError(
                'Geçersiz yenileme token\'ı içeriği',
                401,
                'INVALID_REFRESH_TOKEN_PAYLOAD'
              )
            );
            return;
          }

          // Yenileme token'ı tipini kontrol et
          if ((payload as any).type !== 'refresh') {
            reject(new AuthError('Geçersiz token tipi', 401, 'INVALID_TOKEN_TYPE'));
            return;
          }

          resolve(payload);
        }
      });
    } catch (error) {
      logger.error('Yenileme token\'ı doğrulama hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });

      reject(
        new AuthError('Yenileme token\'ı doğrulama hatası', 401, 'REFRESH_TOKEN_VERIFICATION_ERROR')
      );
    }
  });
}

/**
 * Token'ın geçerlilik süresini kontrol eder
 * @param token JWT token
 * @returns Geçerlilik süresi (saniye)
 */
export function getTokenExpiration(token: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      // Token'ı decode et (doğrulama yapmadan)
      const decoded = jwt.decode(token) as JwtPayload;

      if (!decoded || !decoded.exp) {
        reject(new AuthError('Geçersiz token', 401, 'INVALID_TOKEN'));
        return;
      }

      // Geçerlilik süresini hesapla
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      resolve(expiresIn > 0 ? expiresIn : 0);
    } catch (error) {
      logger.error('Token geçerlilik süresi kontrolü hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });

      reject(
        new AuthError(
          'Token geçerlilik süresi kontrolü hatası',
          401,
          'TOKEN_EXPIRATION_CHECK_ERROR'
        )
      );
    }
  });
}

export default {
  generateToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
  getTokenExpiration,
  parseExpiresIn,
};
