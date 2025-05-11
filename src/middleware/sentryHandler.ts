/**
 * src/middleware/sentryHandler.ts
 * Sentry entegrasyonu için middleware
 */
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Application, Request, Response, NextFunction } from 'express';
import { createMiddlewareHelper } from '../utils/express-helpers';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/express';
import { Breadcrumb, Event } from '@sentry/node';

/**
 * Sentry'yi yapılandır ve başlat
 * @param app - Express uygulaması
 */
export const setupSentry = (app: Application): void => {
  // Sentry DSN tanımlı değilse, Sentry'yi başlatma
  if (!process.env.SENTRY_DSN) {
    logger.warn('Sentry DSN tanımlı değil, Sentry devre dışı bırakıldı');
    return;
  }

  try {
    // Sentry'yi başlat
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        // Express entegrasyonu ekle
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
        // Profilleme entegrasyonu ekle
        new ProfilingIntegration(),
      ],
      // Performans izleme yapılandırması
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Profilleme yapılandırması
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Maksimum istek gövdesi boyutu
      maxValueLength: 5000,
      // Hata örnekleme oranı
      sampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
      // Kullanıcı bilgilerini topla
      sendDefaultPii: true,
      // Sürüm bilgisi
      release: process.env['npm_package_version'] || '0.0.0',
      // Ortam değişkenlerini filtrele
      beforeSend: (event: Event): Event | null => {
        // Hassas bilgileri filtrele
        if (event.request && event.request.headers) {
          if (event.request.headers['authorization']) {
            delete event.request.headers['authorization'];
          }
          if (event.request.headers['cookie']) {
            delete event.request.headers['cookie'];
          }
        }

        // Hassas ortam değişkenlerini filtrele
        if (event.contexts && event.contexts['runtime'] && event.contexts['runtime']['env']) {
          const env = event.contexts['runtime']['env'] as Record<string, string>;
          const sensitiveKeys = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_PASSWORD'];

          sensitiveKeys.forEach((key) => {
            if (env[key]) {
              env[key] = '[FILTERED]';
            }
          });
        }

        return event;
      },
    });

    logger.info('Sentry başarıyla başlatıldı');
  } catch (error) {
    logger.error('Sentry başlatılırken hata oluştu', { error });
  }
};

/**
 * Sentry istek işleme middleware'i
 * Tüm rotalardan önce kullanılmalıdır
 */
export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  // İstek gövdesini yakala
  request: ['data', 'method', 'query_string', 'url'],
  // Kullanıcı bilgilerini yakala
  user: ['id', 'username', 'ip_address'],
  // İstek gövdesi boyutunu sınırla artık desteklenmiyor
});

/**
 * Sentry izleme middleware'i
 * Tüm rotalardan önce ve sentryRequestHandler'dan sonra kullanılmalıdır
 */
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();

/**
 * Sentry hata işleme middleware'i
 * Tüm hata işleyicilerinden önce kullanılmalıdır
 */
export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  // Hata yanıtını değiştirme
  shouldHandleError: (error: any): boolean => {
    // Sadece 500 ve üzeri hataları Sentry'ye gönder
    return error.status === undefined || (typeof error.status === 'number' && error.status >= 500);
  },
});

/**
 * Kullanıcı bilgilerini Sentry'ye ekle
 * Kimlik doğrulama middleware'inden sonra kullanılmalıdır
 * @param req - Express istek nesnesi
 * @param _res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
const _sentryUserContext = (req: Request, _res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  if (authReq.user) {
    Sentry.setUser({
      id: authReq.user.id || authReq.user._id?.toString(),
      username: authReq.user.username,
      ip_address: req.ip,
    });
  } else {
    Sentry.setUser({
      ip_address: req.ip,
    });
  }

  next();
};

// Tip güvenli middleware
export const sentryUserContext = createMiddlewareHelper(_sentryUserContext);

/**
 * Özel etiketleri Sentry'ye ekle
 * @param tags - Etiketler
 */
export const sentrySetTags = (tags: Record<string, string>): void => {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
};

/**
 * Özel bağlamı Sentry'ye ekle
 * @param name - Bağlam adı
 * @param context - Bağlam verisi
 */
export const sentrySetContext = (name: string, context: Record<string, unknown>): void => {
  Sentry.setContext(name, context);
};

/**
 * Özel breadcrumb'ı Sentry'ye ekle
 * @param breadcrumb - Breadcrumb verisi
 */
export const sentryAddBreadcrumb = (breadcrumb: Breadcrumb): void => {
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Hatayı Sentry'ye bildir
 * @param error - Hata nesnesi
 * @param context - Ek bağlam
 */
export const sentryReportError = (error: Error, context?: Record<string, unknown>): void => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
};

// Tüm fonksiyonları içeren nesne
export default {
  setupSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  sentryUserContext,
  sentrySetTags,
  sentrySetContext,
  sentryAddBreadcrumb,
  sentryReportError,
};
