/**
 * src/utils/performanceTracker.ts
 * Gelişmiş performans izleme ve analiz sistemi
 */
import { performance } from 'perf_hooks';
import { logger } from './logger';
import { env } from '../config/env';
import { EventEmitter } from 'events';
import { getCachedData } from '../config/redis';
import os from 'os';
import v8 from 'v8';

// Performans olayları için EventEmitter
export const performanceEmitter = new EventEmitter();

// Performans ölçüm türleri
export enum PerformanceMetricType {
  HTTP_REQUEST = 'http_request',
  DATABASE_QUERY = 'database_query',
  REDIS_OPERATION = 'redis_operation',
  FILE_OPERATION = 'file_operation',
  API_CALL = 'api_call',
  FUNCTION_EXECUTION = 'function_execution',
  SOCKET_EVENT = 'socket_event',
  RENDER_OPERATION = 'render_operation',
  BACKGROUND_TASK = 'background_task',
  OTHER = 'other'
}

// Performans ölçüm kaydı
interface PerformanceRecord {
  id: string;
  name: string;
  type: PerformanceMetricType;
  startTime: number;
  endTime: number;
  duration: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

// Performans istatistikleri
interface PerformanceStats {
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number; // 95. yüzdelik
  p99Duration: number; // 99. yüzdelik
  lastExecuted: Date;
}

// Performans kayıtları
const performanceRecords: PerformanceRecord[] = [];
const MAX_RECORDS = 1000; // Maksimum kayıt sayısı

// Performans istatistikleri
const performanceStats: Record<string, PerformanceStats> = {};

// Yavaş işlem eşikleri (ms)
const SLOW_THRESHOLD = {
  [PerformanceMetricType.HTTP_REQUEST]: 500,
  [PerformanceMetricType.DATABASE_QUERY]: 100,
  [PerformanceMetricType.REDIS_OPERATION]: 50,
  [PerformanceMetricType.FILE_OPERATION]: 200,
  [PerformanceMetricType.API_CALL]: 300,
  [PerformanceMetricType.FUNCTION_EXECUTION]: 100,
  [PerformanceMetricType.SOCKET_EVENT]: 100,
  [PerformanceMetricType.RENDER_OPERATION]: 50,
  [PerformanceMetricType.BACKGROUND_TASK]: 1000,
  [PerformanceMetricType.OTHER]: 200
};

// Kritik işlem eşikleri (ms)
const CRITICAL_THRESHOLD = {
  [PerformanceMetricType.HTTP_REQUEST]: 2000,
  [PerformanceMetricType.DATABASE_QUERY]: 500,
  [PerformanceMetricType.REDIS_OPERATION]: 200,
  [PerformanceMetricType.FILE_OPERATION]: 1000,
  [PerformanceMetricType.API_CALL]: 1000,
  [PerformanceMetricType.FUNCTION_EXECUTION]: 500,
  [PerformanceMetricType.SOCKET_EVENT]: 500,
  [PerformanceMetricType.RENDER_OPERATION]: 200,
  [PerformanceMetricType.BACKGROUND_TASK]: 5000,
  [PerformanceMetricType.OTHER]: 1000
};

/**
 * Benzersiz ID oluştur
 * @returns Benzersiz ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Yüzdelik hesapla
 * @param values - Değerler dizisi
 * @param percentile - Yüzdelik (0-100)
 * @returns Yüzdelik değer
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  // Değerleri sırala
  const sorted = [...values].sort((a, b) => a - b);

  // Yüzdelik indeksini hesapla
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

/**
 * Performans istatistiklerini güncelle
 * @param name - İşlem adı
 * @param duration - İşlem süresi (ms)
 */
function updatePerformanceStats(name: string, duration: number): void {
  // İstatistikleri al veya oluştur
  const stats = performanceStats[name] || {
    count: 0,
    totalDuration: 0,
    avgDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    p95Duration: 0,
    p99Duration: 0,
    lastExecuted: new Date()
  };

  // İstatistikleri güncelle
  stats.count++;
  stats.totalDuration += duration;
  stats.avgDuration = stats.totalDuration / stats.count;
  stats.minDuration = Math.min(stats.minDuration, duration);
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.lastExecuted = new Date();

  // Yüzdelikleri hesapla (en az 10 kayıt varsa)
  if (stats.count >= 10) {
    // Son 100 kaydı al
    const recentRecords = performanceRecords
      .filter(record => record.name === name)
      .slice(-100)
      .map(record => record.duration);

    stats.p95Duration = calculatePercentile(recentRecords, 95);
    stats.p99Duration = calculatePercentile(recentRecords, 99);
  }

  // İstatistikleri güncelle
  performanceStats[name] = stats;
}

/**
 * Performans ölçümü başlat
 * @param name - İşlem adı
 * @param type - İşlem türü
 * @param metadata - Ek bilgiler
 * @returns Ölçüm ID'si
 */
export function startMeasure(
  name: string,
  type: PerformanceMetricType = PerformanceMetricType.OTHER,
  metadata: Record<string, any> = {}
): string {
  const id = generateId();
  const startTime = performance.now();

  // Başlangıç olayını yayınla
  performanceEmitter.emit('measure_start', {
    id,
    name,
    type,
    startTime,
    metadata,
    timestamp: new Date()
  });

  return id;
}

/**
 * Performans ölçümü bitir
 * @param id - Ölçüm ID'si
 * @param additionalMetadata - Ek bilgiler
 * @returns Ölçüm süresi (ms)
 */
export function endMeasure(
  id: string,
  additionalMetadata: Record<string, any> = {}
): number | null {
  // Başlangıç kaydını bul
  const startEvent = performanceRecords.find(record => record.id === id && !record.endTime);

  if (!startEvent) {
    logger.warn(`Performans ölçümü bulunamadı: ${id}`);
    return null;
  }

  // Bitiş zamanını ve süreyi hesapla
  const endTime = performance.now();
  const duration = endTime - startEvent.startTime;

  // Metadata'yı birleştir
  const metadata = {
    ...startEvent.metadata,
    ...additionalMetadata
  };

  // Kaydı güncelle
  startEvent.endTime = endTime;
  startEvent.duration = duration;
  startEvent.metadata = metadata;

  // Performans istatistiklerini güncelle
  updatePerformanceStats(startEvent.name, duration);

  // Yavaş işlemleri logla
  const slowThreshold = SLOW_THRESHOLD[startEvent.type];
  const criticalThreshold = CRITICAL_THRESHOLD[startEvent.type];

  if (duration > criticalThreshold) {
    logger.warn(`Kritik yavaş işlem: ${startEvent.name} (${startEvent.type})`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${criticalThreshold}ms`,
      ...metadata
    });

    // Kritik yavaş işlem olayını yayınla
    performanceEmitter.emit('critical_slow_operation', {
      ...startEvent,
      threshold: criticalThreshold,
      timestamp: new Date()
    });
  } else if (duration > slowThreshold) {
    logger.debug(`Yavaş işlem: ${startEvent.name} (${startEvent.type})`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${slowThreshold}ms`,
      ...metadata
    });

    // Yavaş işlem olayını yayınla
    performanceEmitter.emit('slow_operation', {
      ...startEvent,
      threshold: slowThreshold,
      timestamp: new Date()
    });
  }

  // Bitiş olayını yayınla
  performanceEmitter.emit('measure_end', {
    ...startEvent,
    timestamp: new Date()
  });

  // Performans kaydını ekle
  performanceRecords.push(startEvent);

  // Maksimum kayıt sayısını aşarsa en eski kaydı sil
  if (performanceRecords.length > MAX_RECORDS) {
    performanceRecords.shift();
  }

  return duration;
}

/**
 * Asenkron işlem performansını ölç
 * @param name - İşlem adı
 * @param fn - Ölçülecek asenkron fonksiyon
 * @param type - İşlem türü
 * @param metadata - Ek bilgiler
 * @returns Fonksiyon sonucu
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  type: PerformanceMetricType = PerformanceMetricType.FUNCTION_EXECUTION,
  metadata: Record<string, any> = {}
): Promise<T> {
  // Ölçümü başlat
  const id = startMeasure(name, type, metadata);

  try {
    // Fonksiyonu çalıştır
    const result = await fn();

    // Ölçümü bitir
    endMeasure(id, { success: true });

    return result;
  } catch (error) {
    // Hata durumunda ölçümü bitir
    endMeasure(id, {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });

    throw error;
  }
}

/**
 * Senkron işlem performansını ölç
 * @param name - İşlem adı
 * @param fn - Ölçülecek senkron fonksiyon
 * @param type - İşlem türü
 * @param metadata - Ek bilgiler
 * @returns Fonksiyon sonucu
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  type: PerformanceMetricType = PerformanceMetricType.FUNCTION_EXECUTION,
  metadata: Record<string, any> = {}
): T {
  // Ölçümü başlat
  const id = startMeasure(name, type, metadata);

  try {
    // Fonksiyonu çalıştır
    const result = fn();

    // Ölçümü bitir
    endMeasure(id, { success: true });

    return result;
  } catch (error) {
    // Hata durumunda ölçümü bitir
    endMeasure(id, {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });

    throw error;
  }
}

/**
 * Veritabanı sorgusu performansını ölç
 * @param name - Sorgu adı
 * @param fn - Ölçülecek sorgu fonksiyonu
 * @param metadata - Ek bilgiler
 * @returns Sorgu sonucu
 */
export async function measureDatabaseQuery<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  return measure(name, fn, PerformanceMetricType.DATABASE_QUERY, metadata);
}

/**
 * Redis işlemi performansını ölç
 * @param name - İşlem adı
 * @param fn - Ölçülecek Redis fonksiyonu
 * @param metadata - Ek bilgiler
 * @returns İşlem sonucu
 */
export async function measureRedisOperation<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  return measure(name, fn, PerformanceMetricType.REDIS_OPERATION, metadata);
}

/**
 * HTTP isteği performansını ölç
 * @param name - İstek adı
 * @param fn - Ölçülecek HTTP isteği fonksiyonu
 * @param metadata - Ek bilgiler
 * @returns İstek sonucu
 */
export async function measureHttpRequest<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  return measure(name, fn, PerformanceMetricType.HTTP_REQUEST, metadata);
}

/**
 * Dosya işlemi performansını ölç
 * @param name - İşlem adı
 * @param fn - Ölçülecek dosya işlemi fonksiyonu
 * @param metadata - Ek bilgiler
 * @returns İşlem sonucu
 */
export async function measureFileOperation<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  return measure(name, fn, PerformanceMetricType.FILE_OPERATION, metadata);
}

/**
 * Harici API çağrısı performansını ölç
 * @param name - API çağrısı adı
 * @param fn - Ölçülecek API çağrısı fonksiyonu
 * @param metadata - Ek bilgiler
 * @returns API çağrısı sonucu
 */
export async function measureApiCall<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> {
  return measure(name, fn, PerformanceMetricType.API_CALL, metadata);
}

/**
 * Performans istatistiklerini al
 * @returns Performans istatistikleri
 */
export async function getPerformanceStats(): Promise<any> {
  return await getCachedData(
    'performance:stats',
    async () => {
      // Sistem bilgilerini al
      const memoryUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const cpuUsage = process.cpuUsage();
      const loadAvg = os.loadavg();
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const cpuCount = os.cpus().length;

      // İşlem istatistiklerini hesapla
      const operationStats = Object.entries(performanceStats).map(([name, stats]) => ({
        name,
        count: stats.count,
        avgDuration: stats.avgDuration.toFixed(2),
        minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration.toFixed(2),
        maxDuration: stats.maxDuration.toFixed(2),
        p95Duration: stats.p95Duration.toFixed(2),
        p99Duration: stats.p99Duration.toFixed(2),
        lastExecuted: stats.lastExecuted
      })).sort((a, b) => b.count - a.count);

      // Yavaş işlemleri hesapla
      const slowOperations = performanceRecords
        .filter(record => {
          const threshold = SLOW_THRESHOLD[record.type];
          return record.duration > threshold;
        })
        .slice(-10)
        .map(record => ({
          name: record.name,
          type: record.type,
          duration: record.duration.toFixed(2),
          threshold: SLOW_THRESHOLD[record.type],
          timestamp: new Date(record.timestamp),
          metadata: record.metadata
        }));

      return {
        timestamp: new Date(),
        system: {
          memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            arrayBuffers: Math.round((memoryUsage.arrayBuffers || 0) / 1024 / 1024),
            heapSizeLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024),
            heapUsagePercentage: ((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            loadAvg: loadAvg,
            cpuCount: cpuCount
          },
          os: {
            freeMem: Math.round(freeMem / 1024 / 1024),
            totalMem: Math.round(totalMem / 1024 / 1024),
            memUsagePercentage: ((1 - freeMem / totalMem) * 100).toFixed(2),
            uptime: Math.floor(os.uptime() / 60) // dakika cinsinden
          }
        },
        operations: {
          stats: operationStats,
          slowOperations: slowOperations,
          totalCount: performanceRecords.length
        }
      };
    },
    { ttl: 60, staleWhileRevalidate: true }
  );
}

/**
 * Performans izlemeyi başlat
 */
export function startPerformanceTracking(): void {
  // Performans olaylarını dinle
  performanceEmitter.on('critical_slow_operation', (data) => {
    // Kritik yavaş işlem durumunda yapılacak işlemler
    // Örneğin: Bildirim gönder, alarm oluştur, vb.
    if (env.isProduction) {
      // Burada bildirim gönderme kodu olabilir
    }
  });

  // Periyodik olarak performans istatistiklerini logla
  setInterval(() => {
    getPerformanceStats().then((stats) => {
      logger.info('Performans istatistikleri', { stats });
    }).catch((error) => {
      logger.error('Performans istatistikleri alınırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    });
  }, 60 * 60 * 1000); // Her saat

  logger.info('Performans izleme sistemi başlatıldı');
}

export default {
  measure,
  measureSync,
  measureDatabaseQuery,
  measureRedisOperation,
  measureHttpRequest,
  measureFileOperation,
  measureApiCall,
  getPerformanceStats,
  startPerformanceTracking,
  performanceEmitter
};