/**
 * src/routes/health.ts
 * Sağlık kontrolü rotaları
 */
import express, { Request, Response, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { redisClient, redisConnectionManager } from '../config/redis';
import os from 'os';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * Veritabanı bağlantısını kontrol eder
 * @returns Veritabanı durumu
 */
async function checkDatabaseConnection() {
  try {
    // Veritabanı bağlantısını kontrol et
    if (mongoose.connection.readyState !== 1) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Database connection is not established'
      };
    }

    // Ping komutu ile bağlantıyı test et
    await mongoose.connection.db.admin().ping();

    return {
      healthy: true,
      status: 'connected',
      version: mongoose.version
    };
  } catch (error) {
    logger.error('Database health check error', { error });

    return {
      healthy: false,
      status: 'error',
      error: (error as Error).message
    };
  }
}

/**
 * Redis bağlantısını kontrol eder
 * @returns Redis durumu
 */
async function checkRedisConnection() {
  try {
    // Redis bağlantı durumunu kontrol et
    const isHealthy = redisConnectionManager.isHealthy();

    if (!isHealthy) {
      return {
        healthy: false,
        status: 'unhealthy',
        state: redisConnectionManager.getState(),
        error: 'Redis connection is not healthy'
      };
    }

    // Redis bağlantısını kontrol et
    const pong = await redisClient.ping();

    if (pong !== 'PONG') {
      return {
        healthy: false,
        status: 'error',
        error: 'Redis ping failed'
      };
    }

    // Redis bilgilerini al
    const info = await redisClient.info();
    const version = info.match(/redis_version:(.*)/)?.[1]?.trim() || 'unknown';

    return {
      healthy: true,
      status: 'connected',
      state: redisConnectionManager.getState(),
      version
    };
  } catch (error) {
    logger.error('Redis health check error', { error });

    return {
      healthy: false,
      status: 'error',
      state: redisConnectionManager.getState(),
      error: (error as Error).message
    };
  }
}

/**
 * Disk alanını kontrol eder
 * @returns Disk durumu
 */
async function checkDiskSpace() {
  try {
    // Disk alanı kontrolü için bir kütüphane kullanılabilir
    // Burada basit bir kontrol yapıyoruz
    const totalSpace = os.totalmem();
    const freeSpace = os.freemem();
    const usedSpace = totalSpace - freeSpace;
    const usedPercentage = (usedSpace / totalSpace) * 100;

    // Logs dizinini kontrol et
    const logsDir = path.join(process.cwd(), 'logs');
    let logStats = null;

    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir);
      const totalLogSize = logFiles.reduce((total, file) => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return total + stats.size;
      }, 0);

      logStats = {
        fileCount: logFiles.length,
        totalSize: `${(totalLogSize / 1024 / 1024).toFixed(2)} MB`
      };
    }

    return {
      healthy: usedPercentage < 90, // %90'dan az kullanım sağlıklı
      status: usedPercentage < 90 ? 'ok' : 'warning',
      usedPercentage: usedPercentage.toFixed(2),
      totalSpace: `${Math.round(totalSpace / 1024 / 1024 / 1024)} GB`,
      freeSpace: `${Math.round(freeSpace / 1024 / 1024 / 1024)} GB`,
      logs: logStats
    };
  } catch (error) {
    logger.error('Disk space check error', { error });

    return {
      healthy: false,
      status: 'error',
      error: (error as Error).message
    };
  }
}

/**
 * Bellek kullanımını kontrol eder
 * @returns Bellek durumu
 */
function checkMemoryUsage() {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usedPercentage = (usedMemory / totalMemory) * 100;

    return {
      healthy: usedPercentage < 90, // %90'dan az kullanım sağlıklı
      status: usedPercentage < 90 ? 'ok' : 'warning',
      usedPercentage: usedPercentage.toFixed(2),
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    };
  } catch (error) {
    logger.error('Memory usage check error', { error });

    return {
      healthy: false,
      status: 'error',
      error: (error as Error).message
    };
  }
}

/**
 * Loglama sistemini kontrol eder
 * @returns Loglama durumu
 */
function checkLoggingSystem() {
  try {
    // Log dizinini kontrol et
    const logsDir = path.join(process.cwd(), 'logs');
    const logsExist = fs.existsSync(logsDir);

    // Winston logger'ı kontrol et
    const loggerHealthy = logger && typeof logger.info === 'function';

    return {
      healthy: logsExist && loggerHealthy,
      status: logsExist && loggerHealthy ? 'ok' : 'warning',
      logsDirectoryExists: logsExist,
      loggerInitialized: loggerHealthy
    };
  } catch (error) {
    logger.error('Logging system check error', { error });

    return {
      healthy: false,
      status: 'error',
      error: (error as Error).message
    };
  }
}

/**
 * Sentry durumunu kontrol eder
 * @returns Sentry durumu
 */
function checkSentryStatus() {
  try {
    // Sentry DSN'in tanımlı olup olmadığını kontrol et
    const sentryDsnDefined = !!process.env.SENTRY_DSN;

    // Sentry'nin başlatılıp başlatılmadığını kontrol et
    const hub = Sentry.getCurrentHub();
    const sentryInitialized = hub && hub.getClient() !== undefined;

    return {
      healthy: sentryDsnDefined && sentryInitialized,
      status: sentryDsnDefined && sentryInitialized ? 'ok' : 'disabled',
      dsnConfigured: sentryDsnDefined,
      initialized: sentryInitialized
    };
  } catch (error) {
    logger.error('Sentry status check error', { error });

    return {
      healthy: false,
      status: 'error',
      error: (error as Error).message
    };
  }
}

/**
 * Sağlık kontrolü endpoint'i
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Başlangıç zamanını kaydet
    const startTime = Date.now();

    // Veritabanı bağlantısını kontrol et
    const dbStatus = await checkDatabaseConnection();

    // Redis bağlantısını kontrol et
    const redisStatus = await checkRedisConnection();

    // Disk alanını kontrol et
    const diskStatus = await checkDiskSpace();

    // Bellek kullanımını kontrol et
    const memoryStatus = checkMemoryUsage();

    // Loglama sistemini kontrol et
    const loggingStatus = checkLoggingSystem();

    // Sentry durumunu kontrol et
    const sentryStatus = checkSentryStatus();

    // Genel sağlık durumu
    const allHealthy = dbStatus.healthy &&
                       redisStatus.healthy &&
                       diskStatus.healthy &&
                       memoryStatus.healthy &&
                       loggingStatus.healthy;

    const statusCode = allHealthy ? 200 : 503;

    // Yanıt süresini hesapla
    const responseTime = Date.now() - startTime;

    // Sağlık kontrolü sonucunu logla
    logger.info('Health check completed', {
      healthy: allHealthy,
      responseTime,
      dbStatus: dbStatus.status,
      redisStatus: redisStatus.status,
      diskStatus: diskStatus.status,
      memoryStatus: memoryStatus.status,
      loggingStatus: loggingStatus.status,
      sentryStatus: sentryStatus.status
    });

    res.status(statusCode).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      responseTime: `${responseTime}ms`,
      services: {
        database: dbStatus,
        redis: redisStatus,
        disk: diskStatus,
        memory: memoryStatus,
        logging: loggingStatus,
        sentry: sentryStatus
      }
    });
  } catch (error) {
    logger.error('Health check error', { error });

    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

/**
 * Hazırlık kontrolü endpoint'i
 */
router.get('/ready', (req: Request, res: Response) => {
  // Uygulama hazır mı kontrol et
  const isReady = req.app.get('isReady');

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Loglama testi endpoint'i
 */
router.get('/log-test', (req: Request, res: Response) => {
  try {
    // Farklı seviyelerde loglar oluştur
    logger.debug('Debug log test');
    logger.info('Info log test');
    logger.warn('Warning log test');
    logger.error('Error log test', { testError: new Error('Test error') });

    // Yapılandırılmış log
    logger.info('Structured log test', {
      user: req.user?.id || 'anonymous',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id']
    });

    res.status(200).json({
      status: 'success',
      message: 'Log test completed',
      timestamp: new Date().toISOString(),
      logDirectory: path.join(process.cwd(), 'logs')
    });
  } catch (error) {
    logger.error('Log test error', { error });

    res.status(500).json({
      status: 'error',
      message: 'Log test failed',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

/**
 * Sentry testi endpoint'i
 */
// @ts-ignore
router.get('/sentry-test', (function(_req: Request, res: Response) {
  try {
    // Sentry'nin yapılandırılıp yapılandırılmadığını kontrol et
    const hub = Sentry.getCurrentHub();
    const sentryInitialized = hub && hub.getClient() !== undefined;

    if (!sentryInitialized) {
      return res.status(503).json({
        status: 'error',
        message: 'Sentry is not initialized',
        timestamp: new Date().toISOString()
      });
    }

    // Test hatası oluştur
    const testError = new Error('Test Sentry error');
    testError.name = 'SentryTestError';

    // Hatayı Sentry'ye bildir
    Sentry.withScope((scope) => {
      scope.setLevel('warning');
      scope.setTag('test', 'true');
      scope.setContext('test', {
        endpoint: '/sentry-test',
        timestamp: new Date().toISOString()
      });
      Sentry.captureException(testError);
    });

    logger.info('Sentry test completed', {
      error: testError.message,
      sentryInitialized
    });

    res.status(200).json({
      status: 'success',
      message: 'Sentry test error sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Sentry test error', { error });

    res.status(500).json({
      status: 'error',
      message: 'Sentry test failed',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
}));

export default router;
