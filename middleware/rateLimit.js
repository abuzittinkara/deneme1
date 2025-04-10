/**
 * middleware/rateLimit.js
 * İstek sınırlama middleware'leri
 */
const { RateLimitError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { redisClient, incrementCache } = require('../config/redis');

/**
 * Redis tabanlı rate limiter
 * @param {Object} options - Rate limiter seçenekleri
 * @returns {Function} - Middleware fonksiyonu
 */
function redisRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 dakika
    max = 100, // IP başına maksimum istek sayısı
    message = 'İstek sınırı aşıldı, lütfen daha sonra tekrar deneyin',
    statusCode = 429,
    keyGenerator = (req) => req.ip, // Varsayılan olarak IP adresini kullan
    skip = () => false // Hiçbir isteği atla
  } = options;
  
  return async (req, res, next) => {
    try {
      // Rate limiting'i atla
      if (skip(req)) {
        return next();
      }
      
      // Anahtar oluştur
      const key = `rate_limit:${keyGenerator(req)}`;
      
      // İstek sayısını artır
      const current = await incrementCache(key, 1, Math.ceil(windowMs / 1000));
      
      // Kalan istek sayısını hesapla
      const remaining = Math.max(0, max - current);
      
      // Başlıkları ayarla
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + Math.ceil(windowMs / 1000));
      
      // Sınır aşıldıysa hata döndür
      if (current > max) {
        throw new RateLimitError(message);
      }
      
      next();
    } catch (error) {
      logger.warn('Rate limit aşıldı', { 
        ip: req.ip, 
        path: req.path, 
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      
      if (error instanceof RateLimitError) {
        return res.status(statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }
      
      next(error);
    }
  };
}

/**
 * API istekleri için rate limiter
 */
const apiLimiter = redisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına 15 dakikada 100 istek
  message: 'Bu IP adresinden çok fazla istek yapıldı, lütfen 15 dakika sonra tekrar deneyin',
  keyGenerator: (req) => `api:${req.ip}`
});

/**
 * Kimlik doğrulama istekleri için rate limiter
 */
const authLimiter = redisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // IP başına 15 dakikada 10 istek
  message: 'Çok fazla kimlik doğrulama denemesi yapıldı, lütfen 15 dakika sonra tekrar deneyin',
  keyGenerator: (req) => `auth:${req.ip}`
});

/**
 * Kullanıcı başına rate limiter
 */
const userLimiter = redisRateLimiter({
  windowMs: 60 * 1000, // 1 dakika
  max: 30, // Kullanıcı başına 1 dakikada 30 istek
  message: 'Çok fazla istek yapıldı, lütfen 1 dakika sonra tekrar deneyin',
  keyGenerator: (req) => `user:${req.user?.sub || req.ip}`,
  skip: (req) => !req.user // Kimliği doğrulanmamış istekleri atla
});

module.exports = {
  redisRateLimiter,
  apiLimiter,
  authLimiter,
  userLimiter
};
