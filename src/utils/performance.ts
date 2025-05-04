/**
 * src/utils/performance.ts
 * Performans izleme yardımcı fonksiyonları
 */
import * as Sentry from '@sentry/node';
import { logger } from './logger';
import v8 from 'v8';
import os from 'os';

// Performans metrikleri
const metrics = {
  requestCount: 0,
  requestDurations: [] as number[],
  slowRequests: [] as { path: string, method: string, duration: number, timestamp: Date }[],
  startTime: Date.now(),
  lastGcTime: Date.now(),
  memoryUsage: {
    current: process.memoryUsage(),
    peak: process.memoryUsage()
  }
};

// Node.js'de global performance nesnesi
export const performance = {
  now: () => Date.now(),

  /**
   * Veritabanı sorgusu performansını izleme
   * @param queryName - Sorgu adı
   * @param queryFn - Sorgu fonksiyonu
   * @param context - Ek bağlam bilgileri
   * @returns Sorgu sonucu
   */
  measureDatabaseQuery: async <T>(
    queryName: string,
    queryFn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> => {
    const start = Date.now();
    try {
      return await queryFn();
    } finally {
      const duration = Date.now() - start;
      logger.debug(`DB Query: ${queryName}`, {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });

      // Sentry'ye performans verilerini gönder
      if (duration > 1000) { // 1 saniyeden uzun süren işlemler için
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Yavaş DB sorgusu: ${queryName}`,
          data: {
            ...context,
            duration: `${duration.toFixed(2)}ms`,
          },
          level: 'warning',
        });
      }
    }
  },

  /**
   * Redis işlemi performansını izleme
   * @param operationName - İşlem adı
   * @param operationFn - İşlem fonksiyonu
   * @param context - Ek bağlam bilgileri
   * @returns İşlem sonucu
   */
  measureRedisOperation: async <T>(
    operationName: string,
    operationFn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> => {
    const start = Date.now();
    try {
      return await operationFn();
    } finally {
      const duration = Date.now() - start;
      logger.debug(`Redis: ${operationName}`, {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });

      // Sentry'ye performans verilerini gönder
      if (duration > 500) { // 500ms'den uzun süren işlemler için
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Yavaş Redis işlemi: ${operationName}`,
          data: {
            ...context,
            duration: `${duration.toFixed(2)}ms`,
          },
          level: 'warning',
        });
      }
    }
  },

  /**
   * Harici API çağrısı performansını izleme
   * @param apiName - API adı
   * @param apiFn - API çağrı fonksiyonu
   * @param context - Ek bağlam bilgileri
   * @returns API çağrısı sonucu
   */
  measureApiCall: async <T>(
    apiName: string,
    apiFn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> => {
    const start = Date.now();
    try {
      return await apiFn();
    } finally {
      const duration = Date.now() - start;
      logger.debug(`API Call: ${apiName}`, {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });

      // Sentry'ye performans verilerini gönder
      if (duration > 2000) { // 2 saniyeden uzun süren işlemler için
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Yavaş API çağrısı: ${apiName}`,
          data: {
            ...context,
            duration: `${duration.toFixed(2)}ms`,
          },
          level: 'warning',
        });
      }
    }
  }
};

/**
 * Bir fonksiyonun çalışma süresini ölçer
 * @param fn - Ölçülecek fonksiyon
 * @param name - Fonksiyon adı
 * @param context - Ek bağlam bilgileri
 * @returns Fonksiyonun dönüş değeri
 */
export function measurePerformance<T>(
  fn: () => T,
  name: string,
  context: Record<string, any> = {}
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    const duration = Date.now() - start;
    logger.debug(`Performans ölçümü: ${name}`, {
      ...context,
      duration: `${duration.toFixed(2)}ms`,
    });

    // Sentry'ye performans verilerini gönder
    if (duration > 1000) { // 1 saniyeden uzun süren işlemler için
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `Yavaş işlem: ${name}`,
        data: {
          ...context,
          duration: `${duration.toFixed(2)}ms`,
        },
        level: 'warning',
      });
    }
  }
}

/**
 * Bir asenkron fonksiyonun çalışma süresini ölçer
 * @param fn - Ölçülecek asenkron fonksiyon
 * @param name - Fonksiyon adı
 * @param context - Ek bağlam bilgileri
 * @returns Fonksiyonun dönüş değeri
 */
export async function measurePerformanceAsync<T>(
  fn: () => Promise<T>,
  name: string,
  context: Record<string, any> = {}
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    logger.debug(`Performans ölçümü: ${name}`, {
      ...context,
      duration: `${duration.toFixed(2)}ms`,
    });

    // Sentry'ye performans verilerini gönder
    if (duration > 1000) { // 1 saniyeden uzun süren işlemler için
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `Yavaş işlem: ${name}`,
        data: {
          ...context,
          duration: `${duration.toFixed(2)}ms`,
        },
        level: 'warning',
      });
    }
  }
}

/**
 * Express middleware'i olarak performans izleme
 */
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    // İstek tamamlandığında süreyi hesapla
    res.on('finish', () => {
      const duration = Date.now() - start;
      const path = req.originalUrl || req.url;
      const method = req.method;
      const status = res.statusCode;

      // Normal istekler için debug log
      if (duration < 500) {
        logger.debug(`HTTP ${method} ${path} - ${status}`, {
          duration: `${duration.toFixed(2)}ms`,
          method,
          path,
          status,
        });
      }
      // Yavaş istekler için warning log
      else if (duration < 1000) {
        logger.warn(`Yavaş HTTP isteği: ${method} ${path} - ${status}`, {
          duration: `${duration.toFixed(2)}ms`,
          method,
          path,
          status,
          query: JSON.stringify(req.query),
          params: JSON.stringify(req.params),
          ip: req.ip
        });
      }
      // Çok yavaş istekler için error log
      else {
        logger.error(`Çok yavaş HTTP isteği: ${method} ${path} - ${status}`, {
          duration: `${duration.toFixed(2)}ms`,
          method,
          path,
          status,
          query: JSON.stringify(req.query),
          params: JSON.stringify(req.params),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      // Yavaş istekler için Sentry'ye bildir
      if (duration > 1000) {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Yavaş HTTP isteği: ${method} ${path}`,
          data: {
            duration: `${duration.toFixed(2)}ms`,
            method,
            path,
            status,
            query: JSON.stringify(req.query),
            params: JSON.stringify(req.params)
          },
          level: 'warning',
        });

        // Çok yavaş istekler için Sentry'ye olay gönder
        if (duration > 3000) {
          Sentry.captureMessage(`Çok yavaş HTTP isteği: ${method} ${path}`, {
            level: 'warning',
            tags: {
              method,
              path,
              status: status.toString(),
              duration: Math.round(duration).toString()
            }
          });
        }
      }
    });

    next();
  };
}

// Eski fonksiyon, artık performance nesnesi içindeki metodu kullanın
export async function measureDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  return performance.measureDatabaseQuery(queryName, queryFn, context);
}

// Eski fonksiyon, artık performance nesnesi içindeki metodu kullanın
export async function measureRedisOperation<T>(
  operationName: string,
  operationFn: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  return performance.measureRedisOperation(operationName, operationFn, context);
}

// Eski fonksiyon, artık performance nesnesi içindeki metodu kullanın
export async function measureApiCall<T>(
  apiName: string,
  apiFn: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  return performance.measureApiCall(apiName, apiFn, context);
}

/**
 * Performans metriklerini günceller
 */
export function updateMetrics(): void {
  const memoryUsage = process.memoryUsage();

  // Mevcut bellek kullanımını güncelle
  metrics.memoryUsage.current = memoryUsage;

  // Tepe bellek kullanımını güncelle
  if (memoryUsage.heapUsed > metrics.memoryUsage.peak.heapUsed) {
    metrics.memoryUsage.peak = memoryUsage;
  }
}

/**
 * Performans metriklerini loglar
 */
export function logMetrics(): void {
  updateMetrics();

  const uptime = Date.now() - metrics.startTime;
  const memoryUsage = metrics.memoryUsage.current;
  const heapStats = v8.getHeapStatistics();

  // Ortalama istek süresini hesapla
  const avgRequestDuration = metrics.requestDurations.length > 0
    ? metrics.requestDurations.reduce((sum, duration) => sum + duration, 0) / metrics.requestDurations.length
    : 0;

  // Metrikleri logla
  logger.info('Performans metrikleri', {
    uptime: `${Math.floor(uptime / 1000 / 60)} dakika`,
    requestCount: metrics.requestCount,
    avgRequestDuration: `${avgRequestDuration.toFixed(2)}ms`,
    slowRequestCount: metrics.slowRequests.length,
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapSizeLimit: `${Math.round(heapStats.heap_size_limit / 1024 / 1024)} MB`,
      heapUsagePercentage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`
    },
    system: {
      loadAvg: os.loadavg(),
      freeMem: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      totalMem: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
      cpus: os.cpus().length
    }
  });

  // Yavaş istekleri logla
  if (metrics.slowRequests.length > 0) {
    logger.warn('Yavaş istekler', {
      count: metrics.slowRequests.length,
      requests: metrics.slowRequests.slice(0, 5).map(req => ({
        path: req.path,
        method: req.method,
        duration: `${req.duration}ms`,
        timestamp: req.timestamp
      }))
    });
  }

  // Metrikleri sıfırla
  metrics.requestDurations = [];
  metrics.slowRequests = [];
}

/**
 * Bellek kullanımını izleyen periyodik görev
 */
export function startMemoryMonitoring(interval = 60000): NodeJS.Timeout {
  return setInterval(() => {
    updateMetrics();

    const memoryUsage = metrics.memoryUsage.current;
    const heapStats = v8.getHeapStatistics();

    // Bellek kullanımı kritik seviyeye ulaştığında uyar
    if (memoryUsage.heapUsed / heapStats.heap_size_limit > 0.85) {
      logger.warn('Yüksek bellek kullanımı', {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapSizeLimit: `${Math.round(heapStats.heap_size_limit / 1024 / 1024)} MB`,
        heapUsagePercentage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`
      });

      // Garbage collection'ı zorla
      if (Date.now() - metrics.lastGcTime > 300000) { // 5 dakikada bir
        if (global.gc) {
          logger.info('Manuel garbage collection başlatılıyor');
          global.gc();
          metrics.lastGcTime = Date.now();
        }
      }
    }
  }, interval);
}

/**
 * Performans izlemeyi başlat
 */
export function startPerformanceMonitoring(): void {
  // Bellek izlemeyi başlat
  startMemoryMonitoring();

  // Periyodik metrik loglama
  setInterval(logMetrics, 5 * 60 * 1000); // 5 dakikada bir

  logger.info('Performans izleme başlatıldı');
}
