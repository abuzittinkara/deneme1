/**
 * src/middleware/security.ts
 * Güvenlik middleware'leri
 */
import { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Helmet middleware'i
 * Güvenlik başlıklarını ayarlar
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: env.CONTENT_SECURITY_POLICY
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          mediaSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    : false,
  referrerPolicy: {
    policy: env.REFERRER_POLICY,
  },
  frameguard: {
    action: env.FRAME_OPTIONS === 'DENY' ? 'deny' : 'sameorigin',
  },
  hsts: {
    maxAge: env.HSTS_MAX_AGE,
    includeSubDomains: env.HSTS_INCLUDE_SUBDOMAINS,
    preload: env.HSTS_PRELOAD,
  },
  xssFilter: env.XSS_PROTECTION,
  noSniff: true,
  dnsPrefetchControl: {
    allow: false,
  },
});

/**
 * CORS middleware'i
 * Cross-Origin Resource Sharing ayarlarını yapar
 */
export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN || '*',
  methods: env.CORS_METHODS.split(','),
  allowedHeaders: env.CORS_ALLOWED_HEADERS.split(','),
  exposedHeaders: env.CORS_EXPOSED_HEADERS.split(','),
  credentials: env.CORS_CREDENTIALS,
  maxAge: env.CORS_MAX_AGE,
});

/**
 * Rate limit middleware'i
 * API isteklerini sınırlar
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    },
  },
  skip: (req) => {
    // Sağlık kontrolü ve belirli rotaları atla
    return (
      req.path === '/health' ||
      req.path === '/api/health' ||
      req.path === '/api/v1/health' ||
      req.path.startsWith('/public/')
    );
  },
});

/**
 * Cookie parser middleware'i
 * Çerezleri ayrıştırır
 */
export const cookieParserMiddleware = cookieParser(env.COOKIE_SECRET);

/**
 * CSRF middleware'i
 * Cross-Site Request Forgery koruması sağlar
 */
export const csrfMiddleware = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: env.SECURE_COOKIES,
    sameSite: 'lax',
  },
});

/**
 * CSRF token middleware'i
 * CSRF token'ı yanıta ekler
 */
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

/**
 * Güvenli çerez ayarları
 * Çerez güvenlik ayarlarını yapar
 */
export const secureCookieSettings = {
  httpOnly: true,
  secure: env.SECURE_COOKIES,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 1 gün
};

/**
 * İzin verilen host kontrolü
 * İstek host başlığını kontrol eder
 */
export const allowedHostsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host;

  // ALLOWED_HOSTS boşsa veya * ise tüm hostlara izin ver
  if (!env.ALLOWED_HOSTS || env.ALLOWED_HOSTS === '*') {
    return next();
  }

  // Host başlığı yoksa reddet
  if (!host) {
    return next(new Error('Host başlığı gereklidir'));
  }

  // İzin verilen hostları kontrol et
  const allowedHosts = env.ALLOWED_HOSTS.split(',');
  if (allowedHosts.indexOf(host) === -1) {
    return next(new Error(`${host} host'una izin verilmiyor`));
  }

  next();
};

/**
 * Güvenlik middleware'lerini yapılandırır
 * @param app - Express uygulaması
 */
export function setupSecurityMiddleware(app: Application): void {
  // Helmet (güvenlik başlıkları)
  app.use(helmet());

  // Content-Security-Policy başlığı
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'cdn.seslisohbet.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        connectSrc: ["'self'", 'wss://socket.seslisohbet.com', 'https://api.seslisohbet.com'],
        mediaSrc: ["'self'", 'cdn.seslisohbet.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
      },
    })
  );

  // Referrer-Policy başlığı
  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

  // X-XSS-Protection başlığı
  app.use(helmet.xssFilter());

  // X-Content-Type-Options başlığı
  app.use(helmet.noSniff());

  // X-Frame-Options başlığı
  app.use(helmet.frameguard({ action: 'deny' }));

  // HSTS başlığı
  app.use(
    helmet.hsts({
      maxAge: 15552000, // 180 gün
      includeSubDomains: true,
      preload: true,
    })
  );

  // CORS yapılandırması
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400, // 1 gün
    })
  );

  // CSRF koruması (API'ler için gerekli değil, ancak form tabanlı uygulamalar için eklenebilir)
  // app.use(csrf({ cookie: true }));

  // Güvenlik günlüğü middleware'i
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Orijinal end fonksiyonunu kaydet
    const originalEnd = res.end;

    // Yanıt tamamlandığında güvenlik günlüğü oluştur
    const newEnd = function (
      this: Response,
      chunk?: any,
      encoding?: BufferEncoding,
      callback?: () => void
    ): Response {
      // Güvenlik açısından önemli başlıkları kontrol et
      const securityHeaders: Record<string, string | number | string[] | undefined> = {
        'content-security-policy': res.getHeader('content-security-policy'),
        'strict-transport-security': res.getHeader('strict-transport-security'),
        'x-content-type-options': res.getHeader('x-content-type-options'),
        'x-frame-options': res.getHeader('x-frame-options'),
        'x-xss-protection': res.getHeader('x-xss-protection'),
      };

      // Eksik güvenlik başlıkları varsa uyarı günlüğü oluştur
      const missingHeaders = Object.entries(securityHeaders)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingHeaders.length > 0) {
        logger.warn('Eksik güvenlik başlıkları', {
          path: req.path,
          method: req.method,
          missingHeaders,
        });
      }

      // Orijinal end fonksiyonunu çağır
      return originalEnd.call(this, chunk, encoding || 'utf8');
    };

    res.end = newEnd as any;

    next();
  });

  logger.info('Güvenlik middleware\'leri yapılandırıldı');
}

export default {
  helmetMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  cookieParserMiddleware,
  csrfMiddleware,
  csrfTokenMiddleware,
  secureCookieSettings,
  allowedHostsMiddleware,
  setupSecurityMiddleware,
};
