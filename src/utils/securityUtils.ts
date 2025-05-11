/**
 * src/utils/securityUtils.ts
 * Güvenlik ile ilgili yardımcı fonksiyonlar
 */
import crypto from 'crypto';
import { Request } from 'express';
import { logger } from './logger';

/**
 * Güvenli rastgele dize oluşturur
 *
 * @param length - Dize uzunluğu
 * @returns Rastgele dize
 */
export function generateSecureToken(length: number = 32): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Metni hashler
 *
 * @param text - Hashlenecek metin
 * @param algorithm - Hash algoritması
 * @returns Hash
 */
export function hashString(text: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(text).digest('hex');
}

/**
 * Metni HMAC ile imzalar
 *
 * @param text - İmzalanacak metin
 * @param secret - Gizli anahtar
 * @param algorithm - HMAC algoritması
 * @returns İmzalanmış metin
 */
export function hmacSign(text: string, secret: string, algorithm: string = 'sha256'): string {
  return crypto.createHmac(algorithm, secret).update(text).digest('hex');
}

/**
 * Metni şifreler
 *
 * @param text - Şifrelenecek metin
 * @param key - Şifreleme anahtarı
 * @param iv - Başlatma vektörü
 * @param algorithm - Şifreleme algoritması
 * @returns Şifrelenmiş metin
 */
export function encrypt(
  text: string,
  key: string,
  iv: string = generateSecureToken(16),
  algorithm: string = 'aes-256-cbc'
): { encrypted: string; iv: string } {
  // Anahtarı 32 bayta tamamla
  const keyBuffer = Buffer.from(hashString(key).slice(0, 32), 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');

  const cipher = crypto.createCipheriv(algorithm, keyBuffer, ivBuffer);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv,
  };
}

/**
 * Şifrelenmiş metni çözer
 *
 * @param encrypted - Şifrelenmiş metin
 * @param key - Şifreleme anahtarı
 * @param iv - Başlatma vektörü
 * @param algorithm - Şifreleme algoritması
 * @returns Çözülmüş metin
 */
export function decrypt(
  encrypted: string,
  key: string,
  iv: string,
  algorithm: string = 'aes-256-cbc'
): string {
  try {
    // Anahtarı 32 bayta tamamla
    const keyBuffer = Buffer.from(hashString(key).slice(0, 32), 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Şifre çözme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    throw new Error('Şifre çözme hatası');
  }
}

/**
 * HTML karakterlerini escape eder
 *
 * @param html - HTML metni
 * @returns Escape edilmiş metin
 */
export function escapeHtml(html: string): string {
  if (!html) return '';

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * SQL enjeksiyonlarına karşı metni temizler
 *
 * @param text - Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function sanitizeSql(text: string): string {
  if (!text) return '';

  return text
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x1a/g, '\\Z');
}

/**
 * XSS saldırılarına karşı metni temizler
 *
 * @param text - Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function sanitizeXss(text: string): string {
  if (!text) return '';

  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/on\w+=\w+/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, 'data-safe:');
}

/**
 * İstemci IP adresini alır
 *
 * @param req - Express istek nesnesi
 * @returns IP adresi
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];

    return ips ? ips.trim() : '';
  }

  return req.socket.remoteAddress || '';
}

/**
 * Kullanıcı aracı bilgisini alır
 *
 * @param req - Express istek nesnesi
 * @returns Kullanıcı aracı bilgisi
 */
export function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || '';
}

/**
 * Rate limiting için anahtar oluşturur
 *
 * @param req - Express istek nesnesi
 * @param includeUserAgent - Kullanıcı aracı bilgisini dahil et
 * @returns Rate limiting anahtarı
 */
export function getRateLimitKey(req: Request, includeUserAgent: boolean = false): string {
  const ip = getClientIp(req);
  const userId = (req as any).user?._id || 'anonymous';

  if (includeUserAgent) {
    const userAgent = getUserAgent(req);
    return `${ip}:${userId}:${hashString(userAgent).substring(0, 8)}`;
  }

  return `${ip}:${userId}`;
}

/**
 * CSRF token oluşturur
 *
 * @param sessionId - Oturum ID
 * @param secret - Gizli anahtar
 * @returns CSRF token
 */
export function generateCsrfToken(sessionId: string, secret: string): string {
  return hmacSign(`${sessionId}:${Date.now()}`, secret);
}

/**
 * CSRF token doğrular
 *
 * @param token - CSRF token
 * @param sessionId - Oturum ID
 * @param secret - Gizli anahtar
 * @returns Token geçerli mi?
 */
export function validateCsrfToken(token: string, sessionId: string, secret: string): boolean {
  // HMAC ile imzalanmış token'lar için basit bir doğrulama
  // Gerçek uygulamalarda daha karmaşık bir doğrulama gerekebilir
  const hmac = hmacSign(sessionId, secret);

  // Sabit zamanlı karşılaştırma (timing attack'lere karşı)
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(hmac));
}

/**
 * Regex enjeksiyon saldırılarına karşı bir metni temizler
 * @param text - Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function sanitizeRegexString(text: string): string {
  if (!text) return '';

  // Temel temizleme işlemi
  return text.trim();
}

/**
 * Regex özel karakterlerini escape eder
 * @param input - Escape edilecek metin
 * @returns Escape edilmiş metin
 */
export function escapeRegExp(input: string): string {
  if (!input) {
    return '';
  }

  // Regex için özel karakterleri escape et
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Güvenli bir regex arama nesnesi oluşturur
 * @param field - Arama yapılacak alan
 * @param searchText - Arama metni
 * @returns Güvenli regex arama nesnesi
 */
export function createSafeRegexQuery(field: string, searchText: string): Record<string, any> {
  // Arama metnini temizle
  const sanitizedText = sanitizeRegexString(searchText);

  // Boş arama metnini kontrol et
  if (!sanitizedText) {
    return {};
  }

  // Maksimum uzunluğu kontrol et
  const safeText = sanitizedText.length > 100 ? sanitizedText.substring(0, 100) : sanitizedText;

  // Güvenli regex sorgusu oluştur - escapeRegExp kullanarak regex karakterlerini escape et
  const escapedText = escapeRegExp(safeText);
  return { [field]: { $regex: new RegExp(escapedText, 'i') } };
}

/**
 * Güvenli bir şekilde birden fazla alan için regex arama nesnesi oluşturur
 * @param fields - Arama yapılacak alanlar
 * @param searchText - Arama metni
 * @returns Güvenli regex arama nesnesi
 */
export function createSafeMultiFieldRegexQuery(
  fields: string[],
  searchText: string
): Record<string, any>[] {
  // Arama metnini temizle
  const sanitizedText = sanitizeRegexString(searchText);

  // Boş arama metnini kontrol et
  if (!sanitizedText) {
    return [];
  }

  // Maksimum uzunluğu kontrol et
  const safeText = sanitizedText.length > 100 ? sanitizedText.substring(0, 100) : sanitizedText;

  // Regex karakterlerini escape et
  const escapedText = escapeRegExp(safeText);

  // Her alan için güvenli regex sorgusu oluştur
  return fields.map((field) => ({ [field]: { $regex: new RegExp(escapedText, 'i') } }));
}

/**
 * Güvenli bir şekilde dosya yolunu doğrular
 * @param basePath - Temel yol
 * @param userPath - Kullanıcı tarafından sağlanan yol
 * @returns Doğrulanmış yol
 */
export function validateFilePath(basePath: string, userPath: string): string {
  // Kullanıcı yolunu normalize et
  const normalizedPath = userPath.replace(/\\/g, '/');

  // Yol geçişi saldırılarına karşı kontrol et
  if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
    throw new Error('Geçersiz dosya yolu');
  }

  // Güvenli yolu oluştur
  return `${basePath}/${normalizedPath}`.replace(/\/+/g, '/');
}

/**
 * Güvenli bir şekilde rastgele bir sayı oluşturur
 * @param min - Minimum değer (dahil)
 * @param max - Maksimum değer (dahil değil)
 * @returns Rastgele sayı
 */
export function generateSecureRandomNumber(min: number, max: number): number {
  try {
    // crypto.randomInt kullanarak güvenli bir rastgele sayı oluştur
    return crypto.randomInt(min, max);
  } catch (error) {
    logger.error('Güvenli rastgele sayı oluşturma hatası:', { error });
    // Fallback olarak daha az güvenli bir yöntem kullan
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const randomBytes = crypto.randomBytes(bytesNeeded);
    let randomValue = 0;

    for (let i = 0; i < bytesNeeded; i++) {
      if (randomBytes[i] !== undefined) {
        randomValue = (randomValue << 8) | randomBytes[i];
      }
    }

    return min + (randomValue % range);
  }
}

export default {
  generateSecureToken,
  hashString,
  hmacSign,
  encrypt,
  decrypt,
  escapeHtml,
  sanitizeSql,
  sanitizeXss,
  getClientIp,
  getUserAgent,
  getRateLimitKey,
  generateCsrfToken,
  validateCsrfToken,
  sanitizeRegexString,
  escapeRegExp,
  createSafeRegexQuery,
  createSafeMultiFieldRegexQuery,
  validateFilePath,
  generateSecureRandomNumber,
};
