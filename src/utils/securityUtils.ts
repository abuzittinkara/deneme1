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
  return crypto.randomBytes(Math.ceil(length / 2))
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
  return crypto.createHash(algorithm)
    .update(text)
    .digest('hex');
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
  return crypto.createHmac(algorithm, secret)
    .update(text)
    .digest('hex');
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
    iv
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
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
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
    const ips = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor.split(',')[0];
    
    return ips.trim();
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
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(hmac)
  );
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
  validateCsrfToken
};
