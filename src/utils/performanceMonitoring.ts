/**
 * src/utils/performanceMonitoring.ts
 * Performans izleme ve bellek yönetimi
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

/**
 * Bellek kullanımını formatlar
 * @param bytes - Bayt cinsinden bellek kullanımı
 * @returns Formatlanmış bellek kullanımı
 */
export function formatMemoryUsage(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}

/**
 * Mevcut bellek kullanımını alır
 * @returns Bellek kullanımı
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * Bellek kullanımını loglar
 * @param label - Log etiketi
 */
export function logMemoryUsage(label: string = 'Bellek Kullanımı'): void {
  const memoryUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  
  logger.info(label, {
    heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
    heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
    rss: formatMemoryUsage(memoryUsage.rss),
    external: formatMemoryUsage(memoryUsage.external),
    arrayBuffers: formatMemoryUsage(memoryUsage.arrayBuffers || 0),
    heapSizeLimit: formatMemoryUsage(heapStats.heap_size_limit),
    heapUsagePercentage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`
  });
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
      heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
      heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
      rss: formatMemoryUsage(memoryUsage.rss),
      heapSizeLimit: formatMemoryUsage(heapStats.heap_size_limit),
      heapUsagePercentage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`
    },
    system: {
      loadAvg: os.loadavg(),
      freeMem: formatMemoryUsage(os.freemem()),
      totalMem: formatMemoryUsage(os.totalmem()),
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
 * @param interval - İzleme aralığı (ms)
 * @returns İzleme zamanlayıcısı
 */
export function startMemoryMonitoring(interval = 60000): NodeJS.Timeout {
  return setInterval(() => {
    updateMetrics();

    const memoryUsage = metrics.memoryUsage.current;
    const heapStats = v8.getHeapStatistics();
    const heapUsagePercentage = (memoryUsage.heapUsed / heapStats.heap_size_limit) * 100;

    // Bellek kullanımını logla
    logger.debug('Bellek kullanımı', {
      heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
      heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
      rss: formatMemoryUsage(memoryUsage.rss),
      heapSizeLimit: formatMemoryUsage(heapStats.heap_size_limit),
      heapUsagePercentage: `${heapUsagePercentage.toFixed(2)}%`
    });

    // Bellek kullanımı kritik seviyeye ulaştığında uyar
    if (heapUsagePercentage > 85) {
      logger.warn('Yüksek bellek kullanımı', {
        heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
        heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
        heapSizeLimit: formatMemoryUsage(heapStats.heap_size_limit),
        heapUsagePercentage: `${heapUsagePercentage.toFixed(2)}%`
      });

      // Garbage collection'ı zorla
      if (global.gc && Date.now() - metrics.lastGcTime > 300000) { // 5 dakikada bir
        logger.info('Manuel garbage collection başlatılıyor');
        global.gc();
        metrics.lastGcTime = Date.now();
      }
    }
  }, interval);
}

/**
 * Bellek sızıntılarını tespit eden periyodik görev
 * @param interval - İzleme aralığı (ms)
 * @param sampleCount - Örnek sayısı
 * @returns İzleme zamanlayıcısı
 */
export function detectMemoryLeaks(interval = 60000, sampleCount = 5): NodeJS.Timeout {
  const samples: number[] = [];
  
  return setInterval(() => {
    const memoryUsage = process.memoryUsage();
    samples.push(memoryUsage.heapUsed);
    
    // Örnek sayısı yeterli olduğunda analiz yap
    if (samples.length >= sampleCount) {
      // Son örneklerin ortalamasını hesapla
      const avgHeapUsed = samples.reduce((sum, heap) => sum + heap, 0) / samples.length;
      
      // Bellek kullanımı sürekli artıyorsa uyar
      const isIncreasing = samples.every((heap, i) => i === 0 || heap >= samples[i - 1]);
      const growthRate = (samples[samples.length - 1] - samples[0]) / samples[0] * 100;
      
      if (isIncreasing && growthRate > 10) {
        logger.warn('Olası bellek sızıntısı tespit edildi', {
          samples: samples.map(formatMemoryUsage),
          avgHeapUsed: formatMemoryUsage(avgHeapUsed),
          growthRate: `${growthRate.toFixed(2)}%`
        });
        
        // Sentry'ye bildir
        Sentry.captureMessage('Olası bellek sızıntısı tespit edildi', {
          level: 'warning',
          tags: {
            avgHeapUsed: formatMemoryUsage(avgHeapUsed),
            growthRate: `${growthRate.toFixed(2)}%`
          }
        });
      }
      
      // Örnekleri sıfırla
      samples.length = 0;
    }
  }, interval);
}

/**
 * Büyük bir nesneyi temizler
 * @param obj - Temizlenecek nesne
 */
export function cleanupLargeObject(obj: any): void {
  if (!obj) return;
  
  // Nesnenin tüm özelliklerini temizle
  if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      obj[key] = null;
    });
  }
}

/**
 * Performans izlemeyi başlatır
 */
export function startPerformanceMonitoring(): void {
  // Bellek izlemeyi başlat
  const memoryMonitor = startMemoryMonitoring();
  
  // Bellek sızıntılarını tespit et
  const leakDetector = detectMemoryLeaks();
  
  // Periyodik metrik loglama
  const metricLogger = setInterval(logMetrics, 5 * 60 * 1000); // 5 dakikada bir
  
  logger.info('Performans izleme başlatıldı');
  
  // Uygulama kapatılırken zamanlayıcıları temizle
  process.on('SIGTERM', () => {
    clearInterval(memoryMonitor);
    clearInterval(leakDetector);
    clearInterval(metricLogger);
  });
  
  process.on('SIGINT', () => {
    clearInterval(memoryMonitor);
    clearInterval(leakDetector);
    clearInterval(metricLogger);
  });
}

export default {
  formatMemoryUsage,
  getMemoryUsage,
  logMemoryUsage,
  updateMetrics,
  logMetrics,
  startMemoryMonitoring,
  detectMemoryLeaks,
  cleanupLargeObject,
  startPerformanceMonitoring
};
