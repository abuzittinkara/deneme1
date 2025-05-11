/**
 * src/middleware/performanceMiddleware.ts
 * Performans izleme middleware'leri
 */
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';
import { getClientIp } from '../utils/securityUtils';
import { logMemoryUsage } from '../utils/memoryOptimizer';
import { env } from '../config/env';
import {
  startMeasure,
  endMeasure,
  PerformanceMetricType,
  startPerformanceTracking,
} from '../utils/performanceTracker';

/**
 * İstek süresini ölçen middleware
 */
export function requestDuration(req: Request, res: Response, next: NextFunction): void {
  // İstek yolu
  const path = req.originalUrl || req.url;

  // İstek metodu
  const method = req.method;

  // İstek adı
  const requestName = `${method} ${path}`;

  // Performans ölçümü başlat
  const id = startMeasure(requestName, PerformanceMetricType.HTTP_REQUEST, {
    method,
    path,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    userId: (req as any).user?._id,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });

  // İstek tamamlandığında süreyi hesapla ve logla
  res.on('finish', () => {
    const status = res.statusCode;
    const isError = status >= 400;

    // Performans ölçümünü bitir
    const duration = endMeasure(id, {
      statusCode: status,
      contentLength: res.getHeader('content-length'),
      isError,
    });

    // İstek süresini response header'a ekle
    if (!res.headersSent) {
      try {
        res.setHeader('X-Response-Time', `${duration?.toFixed(2)}ms`);

        // Geliştirme modunda ek bilgiler ekle
        if (env.isDevelopment) {
          res.setHeader(
            'X-Memory-Usage',
            `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
          );
          res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
        }
      } catch (error) {
        // Headerlar zaten gönderilmiş olabilir, hatayı yok say
        logger.debug('Response header eklenemedi, headerlar zaten gönderilmiş', { path });
      }
    }
  });

  next();
}

/**
 * Bellek kullanımını izleyen middleware
 */
export function memoryUsageMonitor(req: Request, res: Response, next: NextFunction): void {
  // Sadece belirli aralıklarla bellek kullanımını logla (her 100 istekte bir)
  const requestCount = ((global as any).requestCount = ((global as any).requestCount || 0) + 1);

  if (requestCount % 100 === 0) {
    logMemoryUsage('Bellek Kullanımı (100 istek sonrası)');
  }

  next();
}

/**
 * CPU kullanımını izleyen middleware
 */
export function cpuUsageMonitor(req: Request, res: Response, next: NextFunction): void {
  // İstek başlangıcında CPU kullanımını kaydet
  const startCpuUsage = process.cpuUsage();

  // İstek tamamlandığında CPU kullanımını hesapla
  res.on('finish', () => {
    const endCpuUsage = process.cpuUsage(startCpuUsage);

    // Yüksek CPU kullanımını tespit et (10ms'den fazla CPU zamanı)
    const totalCpuMs = (endCpuUsage.user + endCpuUsage.system) / 1000;

    if (totalCpuMs > 10) {
      logger.warn('Yüksek CPU kullanımı tespit edildi', {
        path: req.originalUrl || req.url,
        method: req.method,
        cpuUser: `${(endCpuUsage.user / 1000).toFixed(2)}ms`,
        cpuSystem: `${(endCpuUsage.system / 1000).toFixed(2)}ms`,
        totalCpu: `${totalCpuMs.toFixed(2)}ms`,
      });
    }
  });

  next();
}

/**
 * Büyük yanıtları izleyen middleware
 */
export function largeResponseMonitor(req: Request, res: Response, next: NextFunction): void {
  // Orijinal res.end metodunu kaydet
  const originalEnd = res.end;
  let responseSize = 0;

  // res.write metodunu override et
  const originalWrite = res.write;
  res.write = function (chunk: any, ...args: any[]): boolean {
    responseSize += chunk.length;
    // TypeScript ile uyumlu hale getir
    return originalWrite.apply(res, [chunk, args[0], args[1]]);
  };

  // res.end metodunu override et
  res.end = function (chunk: any, ...args: any[]): Response {
    if (chunk) {
      responseSize += chunk.length;
    }

    // Büyük yanıtları tespit et (1MB'den büyük yanıtlar)
    if (responseSize > 1024 * 1024) {
      logger.warn('Büyük yanıt tespit edildi', {
        path: req.originalUrl || req.url,
        method: req.method,
        size: `${(responseSize / (1024 * 1024)).toFixed(2)}MB`,
      });
    }

    // TypeScript ile uyumlu hale getir
    return originalEnd.apply(res, [chunk, args[0], args[1]]);
  };

  next();
}

/**
 * Belirli bir rotanın performansını izleyen middleware oluşturur
 * @param name - Rota adı
 * @param metadata - Ek bilgiler
 * @returns Middleware fonksiyonu
 */
export function measureRoute(name: string, metadata: Record<string, any> = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Performans ölçümü başlat
    const id = startMeasure(name, PerformanceMetricType.HTTP_REQUEST, {
      ...metadata,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?._id,
    });

    // İstek tamamlandığında süreyi hesapla ve logla
    res.on('finish', () => {
      // Performans ölçümünü bitir
      endMeasure(id, {
        statusCode: res.statusCode,
        contentLength: res.getHeader('content-length'),
      });
    });

    next();
  };
}

/**
 * Tüm performans izleme middleware'lerini birleştiren fonksiyon
 */
export function performanceMonitoring(req: Request, res: Response, next: NextFunction): void {
  // Tüm performans middleware'lerini uygula
  requestDuration(req, res, () => {});
  memoryUsageMonitor(req, res, () => {});
  cpuUsageMonitor(req, res, () => {});
  largeResponseMonitor(req, res, () => {});

  next();
}

/**
 * Performans middleware'lerini yapılandır
 * @param app - Express uygulaması
 */
export function setupPerformanceMiddleware(app: any): void {
  // Performans izleme sistemini başlat
  startPerformanceTracking();

  // HTTP isteklerinin performansını izle
  app.use(performanceMonitoring);

  logger.info('Performans middleware\'leri yapılandırıldı');
}

export default {
  requestDuration,
  memoryUsageMonitor,
  cpuUsageMonitor,
  largeResponseMonitor,
  performanceMonitoring,
  measureRoute,
  setupPerformanceMiddleware,
};
