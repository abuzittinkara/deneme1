/**
 * src/services/performanceMonitorService.ts
 * Performans izleme servisi
 */
import os from 'os';
import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { getCacheService } from './cacheService';

// Performans metrik türleri
export enum MetricType {
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  REQUEST_DURATION = 'request_duration',
  DATABASE_QUERY = 'database_query',
  CACHE_HIT_RATE = 'cache_hit_rate',
  API_RESPONSE_TIME = 'api_response_time',
  SOCKET_LATENCY = 'socket_latency',
  WEBRTC_CONNECTION = 'webrtc_connection',
  FILE_UPLOAD = 'file_upload',
  CUSTOM = 'custom',
}

// Performans metriği
export interface PerformanceMetric {
  type: MetricType;
  value: number;
  timestamp: number;
  labels: Record<string, string | number>;
}

// Performans izleme servisi
class PerformanceMonitorService extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private isCollecting: boolean = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private observer: PerformanceObserver | null = null;
  private metricsLimit: number = 10000; // Bellekte tutulacak maksimum metrik sayısı
  private samplingInterval: number = 60000; // Örnekleme aralığı (ms)
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;

  constructor() {
    super();
    this.setupPerformanceObserver();
  }

  /**
   * Performans izlemeyi başlatır
   * @param options - İzleme seçenekleri
   */
  startMonitoring(
    options: {
      samplingInterval?: number;
      metricsLimit?: number;
    } = {}
  ): void {
    if (this.isCollecting) {
      logger.warn('Performans izleme zaten çalışıyor');
      return;
    }

    // Seçenekleri ayarla
    this.samplingInterval = options.samplingInterval || this.samplingInterval;
    this.metricsLimit = options.metricsLimit || this.metricsLimit;

    // İzlemeyi başlat
    this.isCollecting = true;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = performance.now();

    // Düzenli aralıklarla sistem metriklerini topla
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.samplingInterval);

    logger.info('Performans izleme başlatıldı', {
      samplingInterval: this.samplingInterval,
      metricsLimit: this.metricsLimit,
    });
  }

  /**
   * Performans izlemeyi durdurur
   */
  stopMonitoring(): void {
    if (!this.isCollecting) {
      logger.warn('Performans izleme zaten durdurulmuş');
      return;
    }

    // İzlemeyi durdur
    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    logger.info('Performans izleme durduruldu');
  }

  /**
   * Performans gözlemcisini ayarlar
   */
  private setupPerformanceObserver(): void {
    try {
      // Performans gözlemcisini oluştur
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        for (const entry of entries) {
          // Özel performans işaretlerini işle
          if (entry.entryType === 'measure') {
            const [type, ...labelParts] = entry.name.split(':');
            const labels: Record<string, string | number> = {};

            // Etiketleri ayrıştır (format: key=value,key2=value2)
            if (labelParts.length > 0) {
              const labelStr = labelParts.join(':');
              const labelPairs = labelStr.split(',');

              for (const pair of labelPairs) {
                // Güvenli bir şekilde anahtar-değer çiftini ayır
                const parts = pair.split('=');
                const key = parts[0];
                const value = parts.length > 1 ? parts.slice(1).join('=') : '';
                if (key && value) {
                  // Sayısal değerleri dönüştür
                  const numValue = Number(value);
                  labels[key] = isNaN(numValue) ? value : numValue;
                }
              }
            }

            // Metriği kaydet
            this.recordMetric({
              type: type as MetricType,
              value: entry.duration,
              timestamp: Date.now(),
              labels,
            });
          }
        }
      });

      // Performans ölçümlerini izle
      this.observer.observe({ entryTypes: ['measure'] });

      logger.debug('Performans gözlemcisi kuruldu');
    } catch (error) {
      logger.error('Performans gözlemcisi kurulurken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Sistem metriklerini toplar
   */
  private collectSystemMetrics(): void {
    try {
      // CPU kullanımını hesapla
      if (this.lastCpuUsage) {
        const currentCpuUsage = process.cpuUsage();
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.lastCpuTime;

        // CPU kullanımını yüzde olarak hesapla
        const userUsage = currentCpuUsage.user - this.lastCpuUsage.user;
        const systemUsage = currentCpuUsage.system - this.lastCpuUsage.system;
        const totalUsage = userUsage + systemUsage;
        const cpuUsagePercent = (totalUsage / 1000 / elapsedTime) * 100;

        // CPU metriğini kaydet
        this.recordMetric({
          type: MetricType.CPU_USAGE,
          value: cpuUsagePercent,
          timestamp: Date.now(),
          labels: {
            cores: os.cpus().length,
            user: userUsage,
            system: systemUsage,
          },
        });

        // Son değerleri güncelle
        this.lastCpuUsage = currentCpuUsage;
        this.lastCpuTime = currentTime;
      }

      // Bellek kullanımını hesapla
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

      // Bellek metriğini kaydet
      this.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: usedMemoryPercent,
        timestamp: Date.now(),
        labels: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers || 0,
          totalMemory,
          freeMemory,
        },
      });

      // Önbellek istatistiklerini topla
      this.collectCacheMetrics();

      // Veritabanı istatistiklerini topla
      this.collectDatabaseMetrics();
    } catch (error) {
      logger.error('Sistem metrikleri toplanırken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Önbellek metriklerini toplar
   */
  private async collectCacheMetrics(): Promise<void> {
    try {
      const cacheService = getCacheService();
      const stats = await cacheService.getStats();

      if (stats && typeof stats === 'object') {
        // Önbellek isabet oranı metriğini kaydet
        if ('hitRate' in stats) {
          this.recordMetric({
            type: MetricType.CACHE_HIT_RATE,
            value: (stats.hitRate as number) * 100, // Yüzde olarak
            timestamp: Date.now(),
            labels: {
              type: stats.type as string,
              size: stats.size as number,
              maxSize: stats.maxSize as number,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Önbellek metrikleri toplanırken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Veritabanı metriklerini toplar
   */
  private async collectDatabaseMetrics(): Promise<void> {
    try {
      // MongoDB bağlantı durumunu kontrol et
      if (mongoose.connection.readyState === 1) {
        // 1 = connected
        // Veritabanı istatistiklerini al
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();

        if (serverStatus && serverStatus.connections) {
          // Bağlantı sayısı metriğini kaydet
          this.recordMetric({
            type: MetricType.DATABASE_QUERY,
            value: serverStatus.connections.current,
            timestamp: Date.now(),
            labels: {
              metric: 'connections',
              available: serverStatus.connections.available,
              totalCreated: serverStatus.connections.totalCreated,
            },
          });
        }

        if (serverStatus && serverStatus.opcounters) {
          // Operasyon sayacı metriğini kaydet
          this.recordMetric({
            type: MetricType.DATABASE_QUERY,
            value: serverStatus.opcounters.query,
            timestamp: Date.now(),
            labels: {
              metric: 'opcounters',
              insert: serverStatus.opcounters.insert,
              update: serverStatus.opcounters.update,
              delete: serverStatus.opcounters.delete,
              getmore: serverStatus.opcounters.getmore,
              command: serverStatus.opcounters.command,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Veritabanı metrikleri toplanırken hata oluştu', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Metrik kaydeder
   * @param metric - Performans metriği
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.isCollecting) return;

    // Metriği kaydet
    this.metrics.push(metric);

    // Metrik sayısı limiti aşarsa en eski metrikleri sil
    if (this.metrics.length > this.metricsLimit) {
      this.metrics = this.metrics.slice(-this.metricsLimit);
    }

    // Metrik olayını yayınla
    this.emit('metric', metric);
  }

  /**
   * Performans ölçümü başlatır
   * @param name - Ölçüm adı
   * @param labels - Ölçüm etiketleri
   */
  startMeasure(name: string, labels: Record<string, string | number> = {}): string {
    if (!this.isCollecting) return name;

    // Etiketleri string'e dönüştür
    const labelStr = Object.entries(labels)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Ölçüm adını oluştur
    const measureName = labelStr ? `${name}:${labelStr}` : name;

    // Ölçümü başlat
    performance.mark(`${measureName}_start`);

    return measureName;
  }

  /**
   * Performans ölçümünü bitirir
   * @param name - Ölçüm adı
   */
  endMeasure(name: string): void {
    if (!this.isCollecting) return;

    try {
      // Ölçümü bitir
      performance.mark(`${name}_end`);

      // Ölçümü hesapla
      performance.measure(name, `${name}_start`, `${name}_end`);

      // İşaretleri temizle
      performance.clearMarks(`${name}_start`);
      performance.clearMarks(`${name}_end`);
    } catch (error) {
      logger.error('Performans ölçümü bitirilirken hata oluştu', {
        error: (error as Error).message,
        name,
      });
    }
  }

  /**
   * Metrikleri getirir
   * @param options - Filtreleme seçenekleri
   * @returns Metrikler
   */
  getMetrics(
    options: {
      type?: MetricType;
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): PerformanceMetric[] {
    // Metrikleri filtrele
    let filteredMetrics = this.metrics;

    // Tür filtresi
    if (options.type) {
      filteredMetrics = filteredMetrics.filter((metric) => metric.type === options.type);
    }

    // Zaman aralığı filtresi
    if (options.startTime) {
      filteredMetrics = filteredMetrics.filter(
        (metric) => metric.timestamp >= (options.startTime || 0)
      );
    }

    if (options.endTime) {
      filteredMetrics = filteredMetrics.filter(
        (metric) => metric.timestamp <= (options.endTime || Date.now())
      );
    }

    // Limit
    if (options.limit && options.limit > 0) {
      filteredMetrics = filteredMetrics.slice(-options.limit);
    }

    return filteredMetrics;
  }

  /**
   * Metrikleri temizler
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.info('Performans metrikleri temizlendi');
  }
}

// Singleton örneği
const performanceMonitorService = new PerformanceMonitorService();

export default performanceMonitorService;
