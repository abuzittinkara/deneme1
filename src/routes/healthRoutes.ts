/**
 * src/routes/healthRoutes.ts
 * Sağlık kontrolü rotaları
 */
import { Router } from 'express';
import { logger } from '../utils/logger';
import databaseService from '../services/databaseService';
import os from 'os';
import v8 from 'v8';
import mongoose from 'mongoose';

const router = Router();

// Uygulama durumu
const appState = {
  startTime: Date.now(),
  version: process.env['npm_package_version'] || '1.0.0',
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Basit sağlık kontrolü
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Uygulama çalışıyor
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Detaylı sağlık kontrolü
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detaylı uygulama durumu
 */
router.get('/detailed', async (req, res) => {
  try {
    // Çalışma süresi
    const uptime = Date.now() - appState.startTime;

    // Bellek kullanımı
    const memoryUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    // Sistem bilgileri
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      loadAvg: os.loadavg(),
    };

    // Veritabanı durumu
    const dbStatus = {
      connected: databaseService.isReady(),
      state: databaseService.getConnectionState(),
      collections:
        mongoose.connection.readyState === 1
          ? Object.keys(mongoose.connection.collections).length
          : 0,
    };

    // Yanıt
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: appState.version,
      uptime: {
        ms: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / (1000 * 60)),
        hours: Math.floor(uptime / (1000 * 60 * 60)),
        days: Math.floor(uptime / (1000 * 60 * 60 * 24)),
        formatted: formatUptime(uptime),
      },
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external),
        heapSizeLimit: formatBytes(heapStats.heap_size_limit),
        heapUsagePercentage: `${((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`,
      },
      system: systemInfo,
      database: dbStatus,
      node: {
        version: process.version,
        env: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    logger.error('Sağlık kontrolü sırasında hata oluştu', {
      error: (error as Error).message,
    });

    res.status(500).json({
      status: 'error',
      error: (error as Error).message,
    });
  }
});

/**
 * Byte değerini insan tarafından okunabilir formata dönüştürür
 * @param bytes Byte değeri
 * @returns Formatlanmış değer
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Milisaniye cinsinden süreyi insan tarafından okunabilir formata dönüştürür
 * @param ms Milisaniye cinsinden süre
 * @returns Formatlanmış süre
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} gün ${hours % 24} saat`;
  } else if (hours > 0) {
    return `${hours} saat ${minutes % 60} dakika`;
  } else if (minutes > 0) {
    return `${minutes} dakika ${seconds % 60} saniye`;
  } else {
    return `${seconds} saniye`;
  }
}

export default router;
