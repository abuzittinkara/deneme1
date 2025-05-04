/**
 * src/middleware/securityMiddleware.ts
 * Güvenlik middleware'leri
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import crypto from 'crypto';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

// Content Security Policy yapılandırması
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'unpkg.com',
      'www.google-analytics.com',
      'www.googletagmanager.com',
      (req: any, res: any) => `'nonce-${res.locals.nonce}'`
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'fonts.googleapis.com',
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'unpkg.com'
    ],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'res.cloudinary.com',
      'cdn.jsdelivr.net',
      'https://secure.gravatar.com',
      'www.google-analytics.com',
      'www.googletagmanager.com',
      'i.imgur.com',
      'placehold.it',
      'placekitten.com'
    ],
    connectSrc: [
      "'self'",
      'wss:',
      'ws:',
      'localhost:*',
      env.isProduction ? env.API_URL || '' : '*',
      env.isProduction ? env.SOCKET_URL || '' : '*',
      '*.sentry.io', // Sentry için
      'www.google-analytics.com',
      'stats.g.doubleclick.net'
    ],
    fontSrc: [
      "'self'",
      'fonts.gstatic.com',
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'data:'
    ],
    objectSrc: ["'none'"],
    mediaSrc: [
      "'self'",
      'blob:',
      'data:',
      'res.cloudinary.com',
      '*.amazonaws.com'
    ],
    frameSrc: [
      "'self'",
      'www.youtube.com',
      'player.vimeo.com'
    ],
    workerSrc: ["'self'", 'blob:'],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: env.isProduction ? [] : null,
    blockAllMixedContent: [],
    reportUri: env.isProduction && env.SENTRY_DSN ? 'https://sentry.io/api/csp-report' : null
  }
};

// Güvenlik başlıkları
export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? contentSecurityPolicy : false,
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000, // 1 yıl
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },
  dnsPrefetchControl: { allow: false }
  // expectCt artık helmet 7.x'te desteklenmiyor
  // expectCt: {
  //   enforce: true,
  //   maxAge: 86400 // 1 gün
  // }
});

// Genel API limitleri
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 dakika
  max: env.RATE_LIMIT_MAX || 100, // IP başına 15 dakikada maksimum 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla istek, lütfen daha sonra tekrar deneyin',
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  skip: (req) => !env.FEATURE_RATE_LIMIT || env.NODE_ENV === 'development', // Geliştirme modunda veya özellik kapalıysa atla
  handler: (req, res, next, options) => {
    logger.warn('Hız sınırı aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?._id
    });

    // Sentry'ye bildir
    if (env.FEATURE_SENTRY) {
      const Sentry = require('@sentry/node');
      Sentry.captureMessage('Rate limit exceeded', {
        level: 'warning',
        tags: {
          ip: req.ip,
          path: req.path,
          method: req.method
        },
        user: {
          ip_address: req.ip,
          id: (req as any).user?._id
        }
      });
    }

    res.status(429).json(options.message);
  }
});

// Kimlik doğrulama limitleri
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // IP başına 1 saatte maksimum 10 başarısız giriş denemesi
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla başarısız giriş denemesi, lütfen daha sonra tekrar deneyin',
      statusCode: 429
    }
  },
  skip: (req) => env.NODE_ENV === 'development', // Geliştirme modunda atla
  handler: (req, res, next, options) => {
    logger.warn('Kimlik doğrulama hız sınırı aşıldı', {
      ip: req.ip,
      username: req.body.username,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json(options.message);
  },
  skipSuccessfulRequests: true, // Başarılı istekleri sayma
  keyGenerator: (req) => {
    // IP + User-Agent ile anahtar oluştur
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}:${userAgent.substring(0, 20)}`;
  }
});

// Hassas işlemler için limitleri
export const sensitiveActionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 saat
  max: 5, // IP başına 24 saatte maksimum 5 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla hassas işlem denemesi, lütfen daha sonra tekrar deneyin',
      statusCode: 429
    }
  },
  skip: (req) => env.NODE_ENV === 'development', // Geliştirme modunda atla
  handler: (req, res, next, options) => {
    logger.warn('Hassas işlem hız sınırı aşıldı', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?._id
    });
    res.status(429).json(options.message);
  },
  skipSuccessfulRequests: false, // Başarılı istekleri de say
  keyGenerator: (req) => {
    // IP + User ID + User-Agent ile anahtar oluştur
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userId = (req as any).user?._id || 'anonymous';
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}:${userId}:${userAgent.substring(0, 20)}`;
  }
});

// CORS yapılandırması
export const corsOptions = {
  origin: env.CORS_ORIGIN || '*',
  methods: env.CORS_METHODS ? env.CORS_METHODS.split(',') : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: env.CORS_ALLOWED_HEADERS ? env.CORS_ALLOWED_HEADERS.split(',') : [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Auth-Token',
    'X-CSRF-Token'
  ],
  exposedHeaders: env.CORS_EXPOSED_HEADERS ? env.CORS_EXPOSED_HEADERS.split(',') : [
    'Content-Range',
    'X-Total-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  credentials: env.CORS_CREDENTIALS !== 'false',
  maxAge: env.CORS_MAX_AGE || 86400, // 1 gün
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Content-Type doğrulama
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Geçersiz Content-Type', {
        contentType,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(415).json({
        success: false,
        error: {
          message: 'Content-Type application/json olmalıdır',
          statusCode: 415
        }
      });
    }
  }

  next();
}

// Nonce oluşturma middleware'i
export function nonceMiddleware(req: Request, res: Response, next: NextFunction) {
  // Her istek için benzersiz bir nonce oluştur
  const nonce = crypto.randomBytes(16).toString('base64');

  // Nonce'u response locals'a ekle
  res.locals.nonce = nonce;

  // Content Security Policy'yi güncelle
  if (res.locals.cspNonce) {
    const csp = res.getHeader('Content-Security-Policy') as string;
    if (csp) {
      const updatedCsp = csp.replace(/'nonce-[^']*'/g, `'nonce-${nonce}'`);
      res.setHeader('Content-Security-Policy', updatedCsp);
    }
  }

  next();
}

/**
 * Güvenlik başlığı ekleme middleware'i
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Temel güvenlik başlıkları
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'DENY');

  // Üretim ortamında ek başlıklar
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  }

  next();
}

/**
 * Güvenlik kontrolleri middleware'i
 */
export function securityChecksMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Host başlığı kontrolü (Host Spoofing koruması)
    const host = req.headers.host;

    // Geliştirme modunda atla
    if (env.isDevelopment) {
      return next();
    }

    // İzin verilen host'lar
    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      env.isProduction && env.API_URL ? new URL(env.API_URL).host : undefined,
      env.ALLOWED_HOSTS ? env.ALLOWED_HOSTS.split(',').map(h => h.trim()) : []
    ].flat().filter(Boolean);

    if (host && !allowedHosts.some(allowedHost => host.includes(allowedHost as string))) {
      logger.warn('Geçersiz host başlığı', {
        host,
        ip: req.ip,
        allowedHosts
      });

      return res.status(403).json({
        success: false,
        error: {
          message: 'Geçersiz host',
          statusCode: 403,
          code: 'INVALID_HOST'
        }
      });
    }

    // Origin kontrolü (CSRF koruması)
    const origin = req.headers.origin;
    if (origin && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const allowedOrigins = [
        'localhost',
        '127.0.0.1',
        env.isProduction && env.CLIENT_URL ? new URL(env.CLIENT_URL).host : undefined,
        env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map(o => o.trim()) : []
      ].flat().filter(Boolean);

      const originHost = origin.includes('://') ? new URL(origin).host : origin;

      if (!allowedOrigins.some(allowedOrigin => originHost.includes(allowedOrigin as string))) {
        logger.warn('Geçersiz origin başlığı', {
          origin,
          ip: req.ip,
          method: req.method,
          path: req.path,
          allowedOrigins
        });

        return res.status(403).json({
          success: false,
          error: {
            message: 'Geçersiz origin',
            statusCode: 403,
            code: 'INVALID_ORIGIN'
          }
        });
      }
    }

    // User-Agent kontrolü (boş User-Agent'ları reddet)
    const userAgent = req.headers['user-agent'];
    if (!userAgent && env.isProduction) {
      logger.warn('User-Agent başlığı eksik', {
        ip: req.ip,
        method: req.method,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        error: {
          message: 'User-Agent başlığı gerekli',
          statusCode: 403,
          code: 'MISSING_USER_AGENT'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Güvenlik kontrolleri hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      path: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Sunucu hatası',
        statusCode: 500,
        code: 'SERVER_ERROR'
      }
    });
  }
}

// Güvenlik middleware'lerini yapılandır
export function setupSecurityMiddleware(app: any): void {
  // Helmet güvenlik başlıkları
  if (env.FEATURE_HELMET) {
    app.use(securityHeaders);
  }

  // Ek güvenlik başlıkları
  app.use(securityHeadersMiddleware);

  // Güvenlik kontrolleri
  app.use(securityChecksMiddleware);

  // Content-Type doğrulama
  app.use(validateContentType);

  // Nonce middleware'i
  app.use(nonceMiddleware);

  // HTTP Parameter Pollution koruması
  app.use(hpp());

  // MongoDB sorgu enjeksiyonu koruması
  app.use(mongoSanitize());

  // XSS koruması
  app.use(xss());

  // CSRF koruması
  if (env.FEATURE_CSRF) {
    const { csrfProtection } = require('./csrfProtection');
    app.use(csrfProtection);
  }

  // Brute force koruması
  if (env.FEATURE_BRUTE_FORCE_PROTECTION) {
    const { bruteForceProtection } = require('./bruteForceProtection');
    app.use('/api/auth/login', bruteForceProtection({
      maxAttempts: 5,
      blockDuration: 30 * 60 * 1000, // 30 dakika
      findUserByUsername: async (username: string) => {
        try {
          const User = require('../models/User').default;
          return await User.findOne({
            $or: [
              { username: username.toLowerCase() },
              { email: username.toLowerCase() }
            ]
          });
        } catch (error) {
          return null;
        }
      }
    }));
  }

  // API hız sınırlayıcı
  if (env.FEATURE_RATE_LIMIT) {
    app.use('/api/', apiLimiter);

    // Kimlik doğrulama hız sınırlayıcı
    app.use('/api/auth/', authLimiter);

    // Hassas işlemler için hız sınırlayıcı
    app.use('/api/users/password/reset', sensitiveActionLimiter);
    app.use('/api/users/email/change', sensitiveActionLimiter);
    app.use('/api/users/delete', sensitiveActionLimiter);
    app.use('/api/auth/2fa', sensitiveActionLimiter);
    app.use('/api/users/role', sensitiveActionLimiter);
  }

  logger.info('Güvenlik middleware\'leri yapılandırıldı', {
    features: {
      helmet: env.FEATURE_HELMET,
      csrf: env.FEATURE_CSRF,
      bruteForceProtection: env.FEATURE_BRUTE_FORCE_PROTECTION,
      rateLimit: env.FEATURE_RATE_LIMIT
    }
  });
}

export default {
  securityHeaders,
  apiLimiter,
  authLimiter,
  sensitiveActionLimiter,
  corsOptions,
  validateContentType,
  nonceMiddleware,
  securityHeadersMiddleware,
  securityChecksMiddleware,
  setupSecurityMiddleware
};
