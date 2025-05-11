/**
 * src/middleware/csrfProtection.ts
 * CSRF koruması middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import crypto from 'crypto';
import { createError } from '../utils/appError';

// CSRF token'larını saklamak için Map
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Belirli aralıklarla süresi dolmuş token'ları temizle
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of csrfTokens.entries()) {
      if (value.expires < now) {
        csrfTokens.delete(key);
      }
    }
  },
  60 * 60 * 1000
); // Her saat temizle

/**
 * CSRF token oluştur
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // Geliştirme modunda atla
    if (env.isDevelopment && !env.FEATURE_CSRF) {
      return next();
    }

    // Kullanıcı oturumu yoksa atla
    if (!(req as any).user) {
      return next();
    }

    // Kullanıcı ID'sini al
    const userId = (req as any).user._id.toString();

    // Benzersiz bir token oluştur
    const token = crypto.randomBytes(32).toString('hex');

    // Token'ı sakla (24 saat geçerli)
    csrfTokens.set(userId, {
      token,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Token'ı yanıta ekle
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // JavaScript tarafından okunabilir olmalı
      secure: env.isProduction, // Üretim ortamında sadece HTTPS üzerinden
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 saat
    });

    // Token'ı başlığa da ekle
    res.setHeader('X-CSRF-Token', token);

    next();
  } catch (error) {
    logger.error('CSRF token oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next();
  }
}

/**
 * CSRF token doğrula
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // GET, HEAD ve OPTIONS isteklerini atla
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Geliştirme modunda atla
    if (env.isDevelopment && !env.FEATURE_CSRF) {
      return next();
    }

    // Kullanıcı oturumu yoksa atla
    if (!(req as any).user) {
      return next();
    }

    // Kullanıcı ID'sini al
    const userId = (req as any).user._id.toString();

    // Saklanan token'ı al
    const storedToken = csrfTokens.get(userId);

    // Token yoksa veya süresi dolmuşsa hata döndür
    if (!storedToken || storedToken.expires < Date.now()) {
      logger.warn('CSRF token bulunamadı veya süresi dolmuş', {
        userId,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      return next(createError('authorization', 'Geçersiz veya süresi dolmuş CSRF token'));
    }

    // İstekteki token'ı al
    const requestToken =
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      req.body._csrf ||
      req.query['_csrf'];

    // Token yoksa hata döndür
    if (!requestToken) {
      logger.warn('CSRF token eksik', {
        userId,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      return next(createError('authorization', 'CSRF token eksik'));
    }

    // Token'ları karşılaştır
    if (requestToken !== storedToken.token) {
      logger.warn('CSRF token eşleşmiyor', {
        userId,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      return next(createError('authorization', 'CSRF token eşleşmiyor'));
    }

    // Token geçerli, devam et
    next();
  } catch (error) {
    logger.error('CSRF token doğrulama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    next(createError('server', 'CSRF token doğrulama hatası'));
  }
}

/**
 * CSRF koruması middleware'i
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // GET, HEAD ve OPTIONS isteklerinde token oluştur
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return generateCsrfToken(req, res, next);
  }

  // Diğer isteklerde token doğrula
  return validateCsrfToken(req, res, next);
}

export default {
  generateCsrfToken,
  validateCsrfToken,
  csrfProtection,
};
