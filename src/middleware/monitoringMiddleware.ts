/**
 * src/middleware/monitoringMiddleware.ts
 * İzleme middleware'leri
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { performance } from '../utils/performance';
import { env } from '../config/env';
import os from 'os';

// Sistem metrikleri
const systemMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  slowRequestCount: 0,
  lastMetricsLog: Date.now()
};

/**
 * Sistem metriklerini loglar
 */
export function logSystemMetrics(): void {
  const uptime = Date.now() - systemMetrics.startTime;
  const memoryUsage = process.memoryUsage();
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;

  logger.info('Sistem metrikleri', {
    metadata: {
      uptime: `${Math.floor(uptime / 1000 / 60)} dakika`,
      requestCount: systemMetrics.requestCount,
      errorCount: systemMetrics.errorCount,
      slowRequestCount: systemMetrics.slowRequestCount,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
        arrayBuffers: `${Math.round((memoryUsage as any).arrayBuffers / 1024 / 1024)} MB`,
      },
      system: {
        freeMem: `${Math.round(freeMem / 1024 / 1024)} MB`,
        totalMem: `${Math.round(totalMem / 1024 / 1024)} MB`,
        freeMemPercentage: `${Math.round((freeMem / totalMem) * 100)}%`,
        loadAvg: loadAvg.map(load => load.toFixed(2)),
        cpuCount
      }
    }
  });

  // Metrikleri sıfırla
  systemMetrics.requestCount = 0;
  systemMetrics.errorCount = 0;
  systemMetrics.slowRequestCount = 0;
  systemMetrics.lastMetricsLog = Date.now();
}

/**
 * İstek sayacı middleware'i
 */
export function requestCounterMiddleware(req: Request, res: Response, next: NextFunction): void {
  // İstek sayacını artır
  systemMetrics.requestCount++;

  // Hata durumunda hata sayacını artır
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      systemMetrics.errorCount++;
    }

    // Yavaş istekleri izle
    const duration = parseInt(res.getHeader('X-Response-Time') as string || '0');
    if (duration > 1000) {
      systemMetrics.slowRequestCount++;
    }

    // Belirli aralıklarla metrikleri logla
    const now = Date.now();
    if (now - systemMetrics.lastMetricsLog > 15 * 60 * 1000) { // 15 dakika
      logSystemMetrics();
    }
  });

  next();
}

/**
 * Yanıt süresi middleware'i
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  // Yanıt tamamlandığında süreyi hesapla
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const time = diff[0] * 1e3 + diff[1] * 1e-6; // milisaniye cinsinden
    try {
      res.setHeader('X-Response-Time', `${time.toFixed(2)}ms`);
    } catch (error) {
      // Başlıklar zaten gönderilmiş olabilir, bu durumu sessizce geç
    }
  });

  next();
}

/**
 * Bellek kullanımı middleware'i
 */
export function memoryUsageMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Bellek kullanımını kontrol et
  const memoryUsage = process.memoryUsage();
  const heapUsed = memoryUsage.heapUsed / 1024 / 1024; // MB cinsinden

  // Bellek kullanımı yüksekse uyar
  if (heapUsed > 1024) { // 1 GB'dan fazla
    logger.warn('Yüksek bellek kullanımı', {
      metadata: {
        heapUsed: `${heapUsed.toFixed(2)} MB`,
        url: req.originalUrl,
        method: req.method
      }
    });

    // Garbage collection'ı zorla
    if (global.gc) {
      logger.info('Manuel garbage collection başlatılıyor');
      global.gc();
    }
  }

  next();
}

/**
 * Sağlık kontrolü middleware'i
 */
export function healthCheckMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  // Sağlık kontrolü isteği ise hemen yanıt ver
  if (req.path === '/api/health' || req.path === '/api/health/detailed') {
    const uptime = Date.now() - systemMetrics.startTime;
    const memoryUsage = process.memoryUsage();

    // Basit sağlık kontrolü
    if (req.path === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        uptime: `${Math.floor(uptime / 1000 / 60)} dakika`
      });
    }

    // Detaylı sağlık kontrolü
    if (req.path === '/api/health/detailed') {
      return res.status(200).json({
        status: 'ok',
        uptime: `${Math.floor(uptime / 1000 / 60)} dakika`,
        version: process.env.npm_package_version || 'unknown',
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          cpus: os.cpus().length,
          loadAvg: os.loadavg(),
          freeMem: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
          totalMem: `${Math.round(os.totalmem() / 1024 / 1024)} MB`
        }
      });
    }
  }

  next();
}

/**
 * İzleme middleware'lerini yapılandır
 * @param app Express uygulaması
 */
export function setupMonitoringMiddleware(app: any): void {
  // Sağlık kontrolü middleware'i
  app.use(healthCheckMiddleware);

  // Yanıt süresi middleware'i
  app.use(responseTimeMiddleware);

  // İstek sayacı middleware'i
  app.use(requestCounterMiddleware);

  // Bellek kullanımı middleware'i (sadece belirli aralıklarla)
  if (env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Her 100 istekte bir bellek kullanımını kontrol et
      if (systemMetrics.requestCount % 100 === 0) {
        memoryUsageMiddleware(req, res, next);
      } else {
        next();
      }
    });
  }

  // Periyodik olarak sistem metriklerini logla
  setInterval(logSystemMetrics, 15 * 60 * 1000); // 15 dakikada bir

  logger.info('İzleme middleware\'leri yapılandırıldı');
}

export default {
  setupMonitoringMiddleware,
  requestCounterMiddleware,
  responseTimeMiddleware,
  memoryUsageMiddleware,
  healthCheckMiddleware,
  logSystemMetrics
};
