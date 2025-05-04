/**
 * src/utils/performanceMonitor.ts
 * Performans izleme ve optimizasyon için yardımcı fonksiyonlar
 */
import { performance } from 'perf_hooks';
import { logger } from './logger';
import { logMemoryUsage } from './memoryOptimizer';

/**
 * Performans ölçüm sonucu
 */
export interface PerformanceMeasurement {
  name: string;
  duration: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

// Son ölçümleri saklamak için dizi
const recentMeasurements: PerformanceMeasurement[] = [];
const MAX_MEASUREMENTS = 100;

/**
 * Bir işlemin performansını ölçer
 *
 * @param name - İşlem adı
 * @param fn - Ölçülecek işlem
 * @param metadata - Ek meta veriler
 * @returns İşlem sonucu
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();

  try {
    // İşlemi çalıştır
    const result = await fn();

    // Süreyi hesapla
    const duration = performance.now() - start;

    // Ölçümü kaydet
    recordMeasurement(name, duration, metadata);

    return result;
  } catch (error) {
    // Hata durumunda da süreyi hesapla
    const duration = performance.now() - start;

    // Ölçümü kaydet (hata ile)
    recordMeasurement(name, duration, {
      ...metadata,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      status: 'error'
    });

    throw error;
  }
}

/**
 * Bir işlemin performansını ölçer (senkron)
 *
 * @param name - İşlem adı
 * @param fn - Ölçülecek işlem
 * @param metadata - Ek meta veriler
 * @returns İşlem sonucu
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const start = performance.now();

  try {
    // İşlemi çalıştır
    const result = fn();

    // Süreyi hesapla
    const duration = performance.now() - start;

    // Ölçümü kaydet
    recordMeasurement(name, duration, metadata);

    return result;
  } catch (error) {
    // Hata durumunda da süreyi hesapla
    const duration = performance.now() - start;

    // Ölçümü kaydet (hata ile)
    recordMeasurement(name, duration, {
      ...metadata,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      status: 'error'
    });

    throw error;
  }
}

/**
 * Ölçümü kaydeder
 *
 * @param name - İşlem adı
 * @param duration - Süre (ms)
 * @param metadata - Ek meta veriler
 */
function recordMeasurement(
  name: string,
  duration: number,
  metadata?: Record<string, any>
): void {
  // Ölçümü oluştur
  const measurement: PerformanceMeasurement = {
    name,
    duration,
    metadata,
    timestamp: Date.now()
  };

  // Ölçümü diziye ekle
  recentMeasurements.push(measurement);

  // Dizi boyutunu kontrol et
  if (recentMeasurements.length > MAX_MEASUREMENTS) {
    recentMeasurements.shift();
  }

  // Yavaş işlemleri logla (100ms'den uzun süren işlemler)
  if (duration > 100) {
    logger.warn('Yavaş işlem tespit edildi', {
      name,
      duration: `${duration.toFixed(2)}ms`,
      ...metadata
    });
  } else {
    logger.debug('İşlem performansı', {
      name,
      duration: `${duration.toFixed(2)}ms`,
      ...metadata
    });
  }
}

/**
 * Son ölçümleri getirir
 *
 * @param limit - Maksimum ölçüm sayısı
 * @returns Son ölçümler
 */
export function getRecentMeasurements(limit: number = MAX_MEASUREMENTS): PerformanceMeasurement[] {
  return recentMeasurements.slice(-limit);
}

/**
 * İşlem adına göre ortalama süreyi hesaplar
 *
 * @param name - İşlem adı
 * @returns Ortalama süre (ms)
 */
export function getAverageDuration(name: string): number {
  const measurements = recentMeasurements.filter(m => m.name === name);

  if (measurements.length === 0) {
    return 0;
  }

  const totalDuration = measurements.reduce((sum, m) => sum + m.duration, 0);
  return totalDuration / measurements.length;
}

/**
 * Performans raporunu oluşturur
 *
 * @returns Performans raporu
 */
export function generatePerformanceReport(): Record<string, any> {
  // İşlem adlarını topla
  const operationNames = Array.from(new Set(recentMeasurements.map(m => m.name)));

  // Her işlem için istatistikleri hesapla
  const operationStats = operationNames.map(name => {
    const measurements = recentMeasurements.filter(m => m.name === name);
    const durations = measurements.map(m => m.duration);

    // İstatistikleri hesapla
    const count = measurements.length;
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / count;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    // Son 24 saat içindeki ölçümleri filtrele
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentMeasurementsLast24Hours = measurements.filter(m => m.timestamp >= last24Hours);

    return {
      name,
      count,
      averageDuration,
      minDuration,
      maxDuration,
      last24HoursCount: recentMeasurementsLast24Hours.length
    };
  });

  // Bellek kullanımını al
  const memoryUsage = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    operations: operationStats,
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    },
    measurements: {
      total: recentMeasurements.length,
      maxStored: MAX_MEASUREMENTS
    }
  };
}

/**
 * Performans izlemeyi başlatır
 *
 * @param interval - Raporlama aralığı (ms)
 * @returns İzlemeyi durduran fonksiyon
 */
export function startPerformanceMonitoring(interval: number = 3600000): () => void {
  // Saatlik performans raporu
  const timer = setInterval(() => {
    const report = generatePerformanceReport();

    logger.info('Performans raporu', { report });

    // Bellek kullanımını logla
    logMemoryUsage('Saatlik bellek kullanımı');
  }, interval);

  // İzlemeyi durduran fonksiyonu döndür
  return () => {
    clearInterval(timer);
  };
}

export default {
  measure,
  measureSync,
  getRecentMeasurements,
  getAverageDuration,
  generatePerformanceReport,
  startPerformanceMonitoring
};
