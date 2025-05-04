/**
 * src/middleware/bruteForceProtection.ts
 * Brute force saldırılarına karşı koruma middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { createError } from '../utils/appError';
import { reportToSentry } from '../utils/errorReporter';

// Başarısız giriş denemelerini saklamak için Map
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  blocked: boolean;
  blockUntil: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

// Belirli aralıklarla süresi dolmuş kayıtları temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    // 24 saatten eski kayıtları temizle
    if (now - value.lastAttempt > 24 * 60 * 60 * 1000) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // Her saat temizle

/**
 * Brute force koruması için anahtar oluştur
 * @param req - Express istek nesnesi
 * @returns Anahtar
 */
function generateKey(req: Request): string {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const username = req.body.username || req.body.email || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  
  return `${ip}:${username}:${userAgent.substring(0, 20)}`;
}

/**
 * Brute force koruması middleware'i
 * @param options - Seçenekler
 * @returns Middleware fonksiyonu
 */
export function bruteForceProtection(options: {
  maxAttempts?: number;
  blockDuration?: number;
  findUserByUsername?: (username: string) => Promise<any>;
} = {}) {
  const maxAttempts = options.maxAttempts || 5;
  const blockDuration = options.blockDuration || 30 * 60 * 1000; // 30 dakika
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Geliştirme modunda atla
      if (env.isDevelopment && !env.FEATURE_BRUTE_FORCE_PROTECTION) {
        return next();
      }
      
      // Anahtar oluştur
      const key = generateKey(req);
      
      // Giriş denemesini al veya oluştur
      const attempt = loginAttempts.get(key) || {
        count: 0,
        lastAttempt: Date.now(),
        blocked: false,
        blockUntil: 0
      };
      
      // Blok kontrolü
      if (attempt.blocked) {
        // Blok süresi dolduysa bloğu kaldır
        if (Date.now() > attempt.blockUntil) {
          attempt.blocked = false;
          attempt.count = 0;
        } else {
          // Blok süresi dolmadıysa hata döndür
          const remainingTime = Math.ceil((attempt.blockUntil - Date.now()) / 1000 / 60);
          
          logger.warn('Hesap bloke edildi', {
            key,
            remainingTime: `${remainingTime} dakika`,
            ip: req.ip,
            username: req.body.username || req.body.email
          });
          
          return next(createError('authentication', `Çok fazla başarısız giriş denemesi. Lütfen ${remainingTime} dakika sonra tekrar deneyin.`));
        }
      }
      
      // Kullanıcı adı veya e-posta kontrolü
      const username = req.body.username || req.body.email;
      
      if (username && options.findUserByUsername) {
        try {
          // Kullanıcıyı bul
          const user = await options.findUserByUsername(username);
          
          // Kullanıcı yoksa başarısız deneme sayısını artır
          if (!user) {
            attempt.count++;
            attempt.lastAttempt = Date.now();
            
            // Maksimum deneme sayısını aştıysa bloke et
            if (attempt.count >= maxAttempts) {
              attempt.blocked = true;
              attempt.blockUntil = Date.now() + blockDuration;
              
              logger.warn('Hesap bloke edildi (kullanıcı bulunamadı)', {
                key,
                attempts: attempt.count,
                blockDuration: `${blockDuration / 1000 / 60} dakika`,
                ip: req.ip,
                username
              });
              
              // Sentry'ye bildir
              reportToSentry(new Error('Brute force attempt detected'), {
                ip: req.ip,
                username,
                userAgent: req.headers['user-agent'],
                attempts: attempt.count
              });
              
              return next(createError('authentication', `Çok fazla başarısız giriş denemesi. Lütfen ${blockDuration / 1000 / 60} dakika sonra tekrar deneyin.`));
            }
            
            // Deneme sayısını güncelle
            loginAttempts.set(key, attempt);
          }
        } catch (error) {
          // Kullanıcı arama hatası, devam et
          logger.error('Kullanıcı arama hatası', {
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            username
          });
        }
      }
      
      // Orijinal işleyiciyi çağır
      const originalEnd = res.end;
      
      // Yanıt sonucuna göre işlem yap
      res.end = function(chunk?: any, encoding?: any, callback?: any) {
        // Yanıt durumunu kontrol et
        if (res.statusCode === 401) {
          // Başarısız giriş, deneme sayısını artır
          attempt.count++;
          attempt.lastAttempt = Date.now();
          
          // Maksimum deneme sayısını aştıysa bloke et
          if (attempt.count >= maxAttempts) {
            attempt.blocked = true;
            attempt.blockUntil = Date.now() + blockDuration;
            
            logger.warn('Hesap bloke edildi (kimlik doğrulama hatası)', {
              key,
              attempts: attempt.count,
              blockDuration: `${blockDuration / 1000 / 60} dakika`,
              ip: req.ip,
              username: req.body.username || req.body.email
            });
            
            // Sentry'ye bildir
            reportToSentry(new Error('Brute force attempt detected'), {
              ip: req.ip,
              username: req.body.username || req.body.email,
              userAgent: req.headers['user-agent'],
              attempts: attempt.count
            });
          }
        } else if (res.statusCode === 200) {
          // Başarılı giriş, deneme sayısını sıfırla
          attempt.count = 0;
          attempt.blocked = false;
        }
        
        // Deneme sayısını güncelle
        loginAttempts.set(key, attempt);
        
        // Orijinal end fonksiyonunu çağır
        return originalEnd.call(this, chunk, encoding, callback);
      };
      
      next();
    } catch (error) {
      logger.error('Brute force koruması hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      next();
    }
  };
}

export default {
  bruteForceProtection
};
