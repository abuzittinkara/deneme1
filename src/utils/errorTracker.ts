/**
 * src/utils/errorTracker.ts
 * Hata izleme ve analiz yardımcı fonksiyonları
 */
import { logger } from './logger';
import { env } from '../config/env';
import { getCachedData } from '../config/redis';
import { EventEmitter } from 'events';

// Hata olayları için EventEmitter
export const errorEmitter = new EventEmitter();

// Hata sayaçları
interface ErrorCount {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: Array<{
    timestamp: Date;
    context?: string;
    metadata?: Record<string, any>;
  }>;
}

// Hata parmak izi
interface ErrorFingerprint {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  path?: string;
  method?: string;
}

// Hata sayaçları
const errorCounts: Record<string, ErrorCount> = {};

// Hata grupları
const errorGroups: Record<
  string,
  {
    fingerprints: string[];
    count: number;
    firstSeen: Date;
    lastSeen: Date;
  }
> = {};

// Hata eşikleri
const ERROR_THRESHOLDS = {
  // 5 dakika içinde 10 aynı hata
  REPEATED_ERROR: { count: 10, timeWindow: 5 * 60 * 1000 },
  // 1 saat içinde 50 aynı hata
  CRITICAL_ERROR: { count: 50, timeWindow: 60 * 60 * 1000 },
  // 1 dakika içinde 20 hata
  ERROR_SPIKE: { count: 20, timeWindow: 60 * 1000 },
};

// Son hata zamanı
let lastErrorTime = Date.now();
// Son 1 dakikadaki hata sayısı
let errorCountLastMinute = 0;

/**
 * Hata parmak izi oluştur
 * @param error - Hata nesnesi
 * @param context - Hata bağlamı
 * @returns Hata parmak izi
 */
export function createErrorFingerprint(error: Error, context?: string): string {
  const errorObj = error as any;

  // Temel parmak izi bileşenleri
  const components = [
    error.name || 'UnknownError',
    error.message || 'Unknown error message',
    errorObj.code,
    errorObj.statusCode,
    context,
  ];

  // Null veya undefined değerleri filtrele
  return components
    .filter(Boolean)
    .join(':')
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .substring(0, 200);
}

/**
 * Hata grubunu belirle
 * @param error - Hata nesnesi
 * @returns Hata grubu
 */
export function determineErrorGroup(error: Error): string {
  const errorObj = error as any;

  // Hata türüne göre gruplandır
  if (error.name === 'ValidationError') return 'validation';
  if (error.name === 'AuthenticationError' || error.name === 'TokenExpiredError')
    return 'authentication';
  if (error.name === 'AuthorizationError' || error.name === 'ForbiddenError')
    return 'authorization';
  if (error.name === 'NotFoundError') return 'not_found';
  if (error.name === 'DatabaseError' || error.name.includes('Mongo') || error.name.includes('DB'))
    return 'database';
  if (
    error.name === 'NetworkError' ||
    error.name.includes('Socket') ||
    error.name.includes('Connection')
  )
    return 'network';
  if (error.name === 'TimeoutError') return 'timeout';
  if (error.name === 'RateLimitError') return 'rate_limit';

  // HTTP durum koduna göre gruplandır
  if (errorObj.statusCode) {
    if (errorObj.statusCode >= 400 && errorObj.statusCode < 500) return 'client_error';
    if (errorObj.statusCode >= 500) return 'server_error';
  }

  // Hata mesajına göre gruplandır
  const message = error.message.toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('memory') || message.includes('heap')) return 'memory';
  if (message.includes('disk') || message.includes('storage') || message.includes('space'))
    return 'disk';
  if (message.includes('cpu') || message.includes('load')) return 'cpu';

  // Varsayılan grup
  return 'other';
}

/**
 * Hatayı izle
 * @param error - Hata nesnesi
 * @param context - Hata bağlamı
 * @param metadata - Ek meta veriler
 */
export function trackError(error: Error, context?: string, metadata?: Record<string, any>): void {
  try {
    // Hata parmak izi oluştur
    const fingerprint = createErrorFingerprint(error, context);

    // Hata grubunu belirle
    const group = determineErrorGroup(error);

    // Hata sayacını güncelle
    if (!errorCounts[fingerprint]) {
      errorCounts[fingerprint] = {
        count: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        samples: [],
      };
    }

    // Sayacı artır
    errorCounts[fingerprint].count++;
    errorCounts[fingerprint].lastSeen = new Date();

    // Örnek ekle (en fazla 10 örnek)
    if (errorCounts[fingerprint].samples.length < 10) {
      errorCounts[fingerprint].samples.push({
        timestamp: new Date(),
        context,
        metadata,
      });
    }

    // Hata grubunu güncelle
    if (!errorGroups[group]) {
      errorGroups[group] = {
        fingerprints: [],
        count: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
      };
    }

    // Parmak izini gruba ekle
    if (!errorGroups[group].fingerprints.includes(fingerprint)) {
      errorGroups[group].fingerprints.push(fingerprint);
    }

    // Grup sayacını artır
    errorGroups[group].count++;
    errorGroups[group].lastSeen = new Date();

    // Tekrarlayan hataları tespit et
    detectRepeatedErrors(fingerprint, group, error, context, metadata);

    // Hata artışlarını tespit et
    detectErrorSpikes(error, context);

    // Hata olayını yayınla
    errorEmitter.emit('error', {
      error,
      fingerprint,
      group,
      context,
      metadata,
      count: errorCounts[fingerprint].count,
    });

    // Son hata zamanını güncelle
    lastErrorTime = Date.now();
    // Son 1 dakikadaki hata sayısını artır
    errorCountLastMinute++;

    // 1 dakika sonra sayacı azalt
    setTimeout(() => {
      errorCountLastMinute = Math.max(0, errorCountLastMinute - 1);
    }, 60 * 1000);
  } catch (trackingError) {
    // Hata izleme sırasında hata oluşursa sessizce logla
    logger.error('Hata izleme sırasında hata oluştu', {
      error: trackingError instanceof Error ? trackingError.message : 'Bilinmeyen hata',
      originalError: error.message,
    });
  }
}

/**
 * Tekrarlayan hataları tespit et
 * @param fingerprint - Hata parmak izi
 * @param group - Hata grubu
 * @param error - Hata nesnesi
 * @param context - Hata bağlamı
 * @param metadata - Ek meta veriler
 */
function detectRepeatedErrors(
  fingerprint: string,
  group: string,
  error: Error,
  context?: string,
  metadata?: Record<string, any>
): void {
  const errorData = errorCounts[fingerprint];

  // Tekrarlayan hata eşiğini kontrol et
  if (errorData && errorData.count >= ERROR_THRESHOLDS.REPEATED_ERROR.count) {
    const timeDiff = errorData.lastSeen.getTime() - errorData.firstSeen.getTime();

    // Zaman penceresi içinde tekrarlayan hata
    if (timeDiff <= ERROR_THRESHOLDS.REPEATED_ERROR.timeWindow) {
      logger.warn('Tekrarlayan hata tespit edildi', {
        error: error.message,
        name: error.name,
        group,
        count: errorData ? errorData.count : 0,
        timeSpan: `${Math.round(timeDiff / 1000)} saniye`,
        context,
      });

      // Tekrarlayan hata olayını yayınla
      errorEmitter.emit('repeated_error', {
        error,
        fingerprint,
        group,
        count: errorData ? errorData.count : 0,
        timeSpan: timeDiff,
        context,
        metadata,
      });
    }
  }

  // Kritik hata eşiğini kontrol et
  if (errorData && errorData.count >= ERROR_THRESHOLDS.CRITICAL_ERROR.count) {
    const timeDiff = errorData.lastSeen.getTime() - errorData.firstSeen.getTime();

    // Zaman penceresi içinde kritik hata
    if (timeDiff <= ERROR_THRESHOLDS.CRITICAL_ERROR.timeWindow) {
      logger.error('Kritik hata tespit edildi', {
        error: error.message,
        name: error.name,
        group,
        count: errorData ? errorData.count : 0,
        timeSpan: `${Math.round(timeDiff / 1000)} saniye`,
        context,
      });

      // Kritik hata olayını yayınla
      errorEmitter.emit('critical_error', {
        error,
        fingerprint,
        group,
        count: errorData ? errorData.count : 0,
        timeSpan: timeDiff,
        context,
        metadata,
      });
    }
  }
}

/**
 * Hata artışlarını tespit et
 * @param error - Hata nesnesi
 * @param context - Hata bağlamı
 */
function detectErrorSpikes(error: Error, context?: string): void {
  // Hata artışı eşiğini kontrol et
  if (errorCountLastMinute >= ERROR_THRESHOLDS.ERROR_SPIKE.count) {
    logger.warn('Hata artışı tespit edildi', {
      count: errorCountLastMinute,
      timeWindow: '1 dakika',
      context,
    });

    // Hata artışı olayını yayınla
    errorEmitter.emit('error_spike', {
      count: errorCountLastMinute,
      timeWindow: '1 dakika',
      lastError: error,
      context,
    });
  }
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
        uniqueErrors: data.fingerprints.length,
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
 * Hata sayaçlarını temizle
 * @param maxAge - Maksimum yaş (ms)
 */
export function cleanupErrorCounts(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();

  // Eski hata sayaçlarını temizle
  Object.entries(errorCounts).forEach(([fingerprint, data]) => {
    if (now - data.lastSeen.getTime() > maxAge) {
      delete errorCounts[fingerprint];
    }
  });

  // Eski hata gruplarını temizle
  Object.entries(errorGroups).forEach(([group, data]) => {
    if (now - data.lastSeen.getTime() > maxAge) {
      delete errorGroups[group];
    }
  });

  logger.debug('Eski hata sayaçları temizlendi', {
    remainingErrors: Object.keys(errorCounts).length,
    remainingGroups: Object.keys(errorGroups).length,
  });
}

// Periyodik temizleme
if (env.isProduction) {
  // 6 saatte bir temizle
  setInterval(
    () => {
      cleanupErrorCounts();
    },
    6 * 60 * 60 * 1000
  );
}

// Hata izleme olaylarını dinle
errorEmitter.on('repeated_error', (data) => {
  // Tekrarlayan hata durumunda yapılacak işlemler
  // Örneğin: Bildirim gönder, alarm oluştur, vb.
  if (env.isProduction) {
    // Burada bildirim gönderme kodu olabilir
  }
});

errorEmitter.on('critical_error', (data) => {
  // Kritik hata durumunda yapılacak işlemler
  // Örneğin: Acil durum bildirimi gönder, servis durumunu güncelle, vb.
  if (env.isProduction) {
    // Burada acil durum bildirimi gönderme kodu olabilir
  }
});

errorEmitter.on('error_spike', (data) => {
  // Hata artışı durumunda yapılacak işlemler
  // Örneğin: Sistem durumunu kontrol et, ölçeklendirme yap, vb.
  if (env.isProduction) {
    // Burada sistem durumu kontrol kodu olabilir
  }
});

export default {
  trackError,
  createErrorFingerprint,
  determineErrorGroup,
  getErrorStats,
  cleanupErrorCounts,
  errorEmitter,
};
