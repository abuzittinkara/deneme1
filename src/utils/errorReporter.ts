/**
 * src/utils/errorReporter.ts
 * Gelişmiş hata raporlama ve izleme sistemi
 */
import * as Sentry from '@sentry/node';
import { logger } from './logger';
import { env } from '../config/env';
import { EventEmitter } from 'events';
import { getCachedData } from '../config/redis';
import { Request } from 'express';
import { performance } from 'perf_hooks';
import os from 'os';

// Hata olayları için EventEmitter
export const errorEmitter = new EventEmitter();

// Hata grupları
interface ErrorGroup {
  count: number;
  fingerprints: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
}

// Hata sayıları
interface ErrorCount {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: Array<{
    message: string;
    stack?: string;
    context?: Record<string, any>;
    timestamp: Date;
  }>;
}

// Hata grupları ve sayıları
const errorGroups: Record<string, ErrorGroup> = {};
const errorCounts: Record<string, ErrorCount> = {};

// Son dakikadaki hata sayısı
let errorCountLastMinute = 0;
let lastMinuteTimestamp = Date.now();

// Hata parmak izi oluştur
function createErrorFingerprint(error: Error, context?: Record<string, any>): string {
  const errorName = error.name || 'UnknownError';
  const errorMessage = error.message || 'No message';
  const errorStack = error.stack || '';

  // Hata yığınından ilk satırı al
  const stackFirstLine = errorStack.split('\n')[1] || '';

  // Parmak izi oluştur
  return `${errorName}:${errorMessage}:${stackFirstLine}`;
}

// Hata grubunu belirle
function determineErrorGroup(error: Error): string {
  const errorName = error.name || 'UnknownError';

  // Hata türüne göre gruplandır
  if (errorName.includes('Validation')) return 'ValidationError';
  if (errorName.includes('Auth') || errorName.includes('Token')) return 'AuthenticationError';
  if (errorName.includes('Permission') || errorName.includes('Forbidden'))
    return 'AuthorizationError';
  if (errorName.includes('NotFound')) return 'NotFoundError';
  if (errorName.includes('Timeout') || errorName.includes('ETIMEDOUT')) return 'TimeoutError';
  if (errorName.includes('Connection') || errorName.includes('Network')) return 'NetworkError';
  if (errorName.includes('Database') || errorName.includes('Mongo')) return 'DatabaseError';
  if (errorName.includes('Redis')) return 'RedisError';
  if (errorName.includes('Syntax') || errorName.includes('Reference')) return 'CodeError';

  // Hata mesajına göre gruplandır
  const errorMessage = error.message || '';
  if (errorMessage.includes('validation')) return 'ValidationError';
  if (errorMessage.includes('auth') || errorMessage.includes('token')) return 'AuthenticationError';
  if (errorMessage.includes('permission') || errorMessage.includes('forbidden'))
    return 'AuthorizationError';
  if (errorMessage.includes('not found') || errorMessage.includes('404')) return 'NotFoundError';
  if (errorMessage.includes('timeout')) return 'TimeoutError';
  if (errorMessage.includes('connect') || errorMessage.includes('network')) return 'NetworkError';
  if (errorMessage.includes('database') || errorMessage.includes('mongo')) return 'DatabaseError';
  if (errorMessage.includes('redis')) return 'RedisError';

  return 'OtherError';
}

// Hata seviyesini belirle
function determineErrorSeverity(
  error: Error,
  context?: Record<string, any>
): 'critical' | 'error' | 'warning' | 'info' {
  const errorName = error.name || 'UnknownError';
  const errorMessage = error.message || '';
  const statusCode = context && 'statusCode' in context ? context['statusCode'] : 500;

  // Kritik hatalar
  if (
    errorName.includes('OutOfMemory') ||
    errorName.includes('Fatal') ||
    errorMessage.includes('crash') ||
    errorMessage.includes('fatal') ||
    statusCode >= 500
  ) {
    return 'critical';
  }

  // Önemli hatalar
  if (
    errorName.includes('Database') ||
    errorName.includes('Mongo') ||
    errorName.includes('Redis') ||
    errorName.includes('Connection') ||
    errorName.includes('Network') ||
    errorName.includes('Timeout') ||
    errorMessage.includes('database') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout')
  ) {
    return 'error';
  }

  // Uyarılar
  if (
    errorName.includes('Validation') ||
    errorName.includes('Auth') ||
    errorName.includes('Token') ||
    errorName.includes('Permission') ||
    errorName.includes('Forbidden') ||
    (statusCode >= 400 && statusCode < 500)
  ) {
    return 'warning';
  }

  return 'info';
}

/**
 * Hatayı izleme sistemine ekle
 * @param error - Hata nesnesi
 * @param path - İstek yolu
 * @param context - Hata bağlamı
 */
export function trackError(error: Error, path?: string, context?: Record<string, any>): void {
  try {
    // Hata parmak izini oluştur
    const errorFingerprint = createErrorFingerprint(error, context);

    // Hata grubunu belirle
    const errorGroup = determineErrorGroup(error);

    // Hata seviyesini belirle
    const errorSeverity = determineErrorSeverity(error, context);

    // Hata grubunu güncelle
    if (!errorGroups[errorGroup]) {
      errorGroups[errorGroup] = {
        count: 0,
        fingerprints: new Set(),
        firstSeen: new Date(),
        lastSeen: new Date(),
      };
    }

    errorGroups[errorGroup].count++;
    errorGroups[errorGroup].fingerprints.add(errorFingerprint);
    errorGroups[errorGroup].lastSeen = new Date();

    // Hata sayısını güncelle
    if (!errorCounts[errorFingerprint]) {
      errorCounts[errorFingerprint] = {
        count: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        samples: [],
      };
    }

    errorCounts[errorFingerprint].count++;
    errorCounts[errorFingerprint].lastSeen = new Date();

    // Örnek hata bilgilerini sakla (en fazla 5 örnek)
    if (errorCounts[errorFingerprint].samples.length < 5) {
      errorCounts[errorFingerprint].samples.push({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date(),
      });
    }

    // Son dakikadaki hata sayısını güncelle
    errorCountLastMinute++;

    // Dakika geçtiyse sayacı sıfırla
    const now = Date.now();
    if (now - lastMinuteTimestamp > 60000) {
      lastMinuteTimestamp = now;

      // Önceki dakikadaki hata sayısını logla
      if (errorCountLastMinute > 0) {
        logger.warn(`Son dakikada ${errorCountLastMinute} hata oluştu`);

        // Hata oranı yüksekse uyarı gönder
        if (errorCountLastMinute > 10) {
          logger.error('Yüksek hata oranı tespit edildi', {
            errorCount: errorCountLastMinute,
            timeFrame: '1 dakika',
          });

          // Hata olayını yayınla
          errorEmitter.emit('high_error_rate', {
            errorCount: errorCountLastMinute,
            timeFrame: '1 dakika',
            timestamp: new Date(),
          });
        }
      }

      errorCountLastMinute = 0;
    }

    // Tekrarlayan hataları tespit et
    if (errorCounts[errorFingerprint].count > 10) {
      const timeDiff =
        errorCounts[errorFingerprint].lastSeen.getTime() -
        errorCounts[errorFingerprint].firstSeen.getTime();

      // Son 5 dakika içinde 10'dan fazla aynı hata
      if (timeDiff < 5 * 60 * 1000) {
        logger.error('Tekrarlayan hata tespit edildi', {
          error: error.message,
          name: error.name,
          count: errorCounts[errorFingerprint].count,
          timeSpan: `${Math.round(timeDiff / 1000)} saniye`,
          severity: errorSeverity,
        });

        // Hata olayını yayınla
        errorEmitter.emit('repeated_error', {
          error: error.message,
          name: error.name,
          fingerprint: errorFingerprint,
          count: errorCounts[errorFingerprint].count,
          timeSpan: `${Math.round(timeDiff / 1000)} saniye`,
          severity: errorSeverity,
          timestamp: new Date(),
        });
      }
    }

    // Kritik hataları hemen bildir
    if (errorSeverity === 'critical') {
      logger.error('Kritik hata tespit edildi', {
        error: error.message,
        name: error.name,
        path,
        context,
        severity: errorSeverity,
      });

      // Hata olayını yayınla
      errorEmitter.emit('critical_error', {
        error: error.message,
        name: error.name,
        path,
        context,
        severity: errorSeverity,
        timestamp: new Date(),
      });
    }
  } catch (trackingError) {
    // Hata izleme sırasında oluşan hatayı logla
    logger.error('Hata izleme sırasında hata oluştu', {
      originalError: error.message,
      trackingError: trackingError instanceof Error ? trackingError.message : 'Bilinmeyen hata',
    });
  }
}

/**
 * Hatayı Sentry'ye bildir
 * @param error - Hata nesnesi
 * @param context - Hata bağlamı
 */
export function reportToSentry(error: Error, context?: Record<string, any>): void {
  // Sentry etkin değilse çık
  if (!env.FEATURE_SENTRY) {
    return;
  }

  try {
    // Hata seviyesini belirle
    const errorSeverity = determineErrorSeverity(error, context);

    // Sentry kapsamı oluştur
    Sentry.configureScope((scope) => {
      // Bağlam bilgilerini ekle
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Hata seviyesini ayarla
      scope.setLevel(
        errorSeverity === 'critical'
          ? 'fatal'
          : errorSeverity === 'error'
            ? 'error'
            : errorSeverity === 'warning'
              ? 'warning'
              : 'info'
      );

      // Parmak izi ekle
      scope.setFingerprint([createErrorFingerprint(error, context)]);

      // Etiketler ekle
      scope.setTags({
        errorGroup: determineErrorGroup(error),
        errorName: error.name || 'UnknownError',
        environment: env.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        hostname: os.hostname(),
      });
    });

    // Hatayı Sentry'ye gönder
    Sentry.captureException(error);
  } catch (sentryError) {
    // Sentry raporlama sırasında oluşan hatayı logla
    logger.error('Sentry raporlama sırasında hata oluştu', {
      originalError: error.message,
      sentryError: sentryError instanceof Error ? sentryError.message : 'Bilinmeyen hata',
    });
  }
}

/**
 * İstek bağlamını oluştur
 * @param req - Express istek nesnesi
 * @returns İstek bağlamı
 */
export function createRequestContext(req: Request): Record<string, any> {
  return {
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
    username: (req as any).user?.username,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Hata istatistiklerini al
 * @returns Hata istatistikleri
 */
export async function getErrorStats(): Promise<any> {
  return await getCachedData(
    'error:stats',
    async () => {
      // Hata gruplarını hesapla
      const groupStats = Object.entries(errorGroups).map(([group, data]) => ({
        group,
        count: data.count,
        uniqueErrors: data.fingerprints.size,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
      }));

      // En sık görülen hataları hesapla
      const topErrors = Object.entries(errorCounts)
        .map(([fingerprint, data]) => ({
          fingerprint,
          count: data.count,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          samples: data.samples,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Son 1 saatteki hataları hesapla
      const now = Date.now();
      const lastHourErrors = Object.entries(errorCounts)
        .filter(([_, data]) => now - data.lastSeen.getTime() <= 60 * 60 * 1000)
        .reduce((count, [_, data]) => count + data.count, 0);

      return {
        totalErrors: Object.values(errorCounts).reduce((sum, data) => sum + data.count, 0),
        uniqueErrors: Object.keys(errorCounts).length,
        errorGroups: groupStats,
        topErrors,
        lastHourErrors,
        errorCountLastMinute,
        timestamp: new Date(),
      };
    },
    { ttl: 60, staleWhileRevalidate: true }
  );
}

/**
 * Hata izleme sistemini başlat
 */
export function startErrorTracking(): void {
  // Yakalanmamış istisnaları izle
  process.on('uncaughtException', (error) => {
    logger.error('Yakalanmamış istisna', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Hatayı izleme sistemine ekle
    trackError(error, 'uncaughtException', {
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    });

    // Hatayı Sentry'ye bildir
    reportToSentry(error, {
      context: 'Yakalanmamış istisna',
      processId: process.pid,
      memoryUsage: JSON.stringify(process.memoryUsage()),
      uptime: process.uptime(),
    });

    // Hata olayını yayınla
    errorEmitter.emit('uncaught_exception', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date(),
    });

    // Kritik hatalardan sonra uygulamayı güvenli bir şekilde kapat
    if (env.isProduction) {
      logger.error('Kritik hata nedeniyle uygulama kapatılıyor');

      // Temizlik işlemleri için biraz bekle
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });

  // İşlenmeyen reddetmeleri izle
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    logger.error('İşlenmeyen reddetme', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Hatayı izleme sistemine ekle
    trackError(error, 'unhandledRejection', {
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    });

    // Hatayı Sentry'ye bildir
    reportToSentry(error, {
      context: 'İşlenmeyen reddetme',
      processId: process.pid,
      memoryUsage: JSON.stringify(process.memoryUsage()),
      uptime: process.uptime(),
    });

    // Hata olayını yayınla
    errorEmitter.emit('unhandled_rejection', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date(),
    });
  });

  // Periyodik olarak hata istatistiklerini logla
  setInterval(
    () => {
      getErrorStats()
        .then((stats) => {
          if (stats.totalErrors > 0) {
            logger.info('Hata istatistikleri', { stats });
          }
        })
        .catch((error) => {
          logger.error('Hata istatistikleri alınırken hata oluştu', {
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          });
        });
    },
    60 * 60 * 1000
  ); // Her saat

  logger.info('Hata izleme sistemi başlatıldı');
}

// Hata olaylarını dinle
errorEmitter.on('critical_error', (_data) => {
  // Kritik hata durumunda yapılacak işlemler
  // Örneğin: Bildirim gönder, alarm oluştur, vb.
  if (env.isProduction) {
    // Burada bildirim gönderme kodu olabilir
  }
});

errorEmitter.on('high_error_rate', (_data) => {
  // Yüksek hata oranı durumunda yapılacak işlemler
  // Örneğin: Bildirim gönder, alarm oluştur, vb.
  if (env.isProduction) {
    // Burada bildirim gönderme kodu olabilir
  }
});

export default {
  trackError,
  reportToSentry,
  createRequestContext,
  getErrorStats,
  startErrorTracking,
  errorEmitter,
};
