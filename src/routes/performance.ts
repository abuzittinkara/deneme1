/**
 * src/routes/performance.ts
 * Performans izleme rotaları
 */
import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  measureSync,
  measure,
  getPerformanceStats,
  PerformanceMetricType,
} from '../utils/performanceTracker';
import os from 'os';
import v8 from 'v8';
import { authMiddleware } from '../middleware/auth';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { env } from '../config/env';
import { createRouteHandler } from '../utils/express-helpers';
import { createError } from '../utils/appError';

const router = express.Router();

/**
 * Sistem performans bilgilerini getirir
 */
router.get('/api/performance/system', authMiddleware, (req: Request, res: Response): void => {
  try {
    // Sistem bilgilerini al
    const systemInfo = {
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
      loadAvg: os.loadavg(),
      uptime: os.uptime() + ' seconds',
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      processUptime: process.uptime() + ' seconds',
    };

    // Bellek kullanımını al
    const memoryUsage = process.memoryUsage();
    const memoryInfo = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
      arrayBuffers: Math.round((memoryUsage as any).arrayBuffers / 1024 / 1024) + ' MB',
    };

    res.json({
      system: systemInfo,
      memory: memoryInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Sistem performans bilgileri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Sistem performans bilgileri alınırken hata oluştu',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
});

/**
 * @swagger
 * /api/performance/metrics:
 *   get:
 *     summary: Performans metriklerini getirir
 *     description: Sistemdeki performans metriklerini döndürür
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: cache
 *         in: query
 *         description: Önbellekten alınıp alınmayacağı (varsayılan true)
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Performans metrikleri başarıyla alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/api/performance/metrics',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    try {
      // Önbellekten mi alınsın?
      const useCache = req.query['cache'] !== 'false';

      // Performans metriklerini al
      const metrics = await getPerformanceStats();

      return res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Performans metrikleri alınırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw createError('server', 'Performans metrikleri alınırken hata oluştu');
    }
  })
);

/**
 * Performans durumunu getirir
 */
router.get('/api/performance/status', requireAuth, async (req: Request, res: Response) => {
  try {
    // Performans metriklerini al
    // Geçici olarak mock veri kullanıyoruz
    const metrics = {
      cpu: { usage: 30, loadAvg: [1.2, 1.0, 0.8] },
      memory: { usedPercent: 40, free: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024 },
      eventLoop: { avg: 20, high: 50 },
      requests: { active: 5, total: 1000, errors: 10 },
      uptime: 3600,
    };

    // Sistem durumunu hesapla
    const cpuStatus =
      metrics.cpu.usage < 70 ? 'normal' : metrics.cpu.usage < 90 ? 'warning' : 'critical';
    const memoryStatus =
      metrics.memory.usedPercent < 70
        ? 'normal'
        : metrics.memory.usedPercent < 90
          ? 'warning'
          : 'critical';
    const eventLoopStatus =
      metrics.eventLoop.avg < 50 ? 'normal' : metrics.eventLoop.avg < 100 ? 'warning' : 'critical';

    // Genel durum
    const overallStatus = [cpuStatus, memoryStatus, eventLoopStatus].includes('critical')
      ? 'critical'
      : [cpuStatus, memoryStatus, eventLoopStatus].includes('warning')
        ? 'warning'
        : 'normal';

    // Durum raporu
    const status = {
      overall: overallStatus,
      components: {
        cpu: {
          status: cpuStatus,
          usage: metrics.cpu.usage.toFixed(2) + '%',
          loadAvg: metrics.cpu.loadAvg,
        },
        memory: {
          status: memoryStatus,
          usage: metrics.memory.usedPercent.toFixed(2) + '%',
          free: (metrics.memory.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          total: (metrics.memory.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        },
        eventLoop: {
          status: eventLoopStatus,
          avgLag: metrics.eventLoop.avg.toFixed(2) + ' ms',
          maxLag: metrics.eventLoop.high.toFixed(2) + ' ms',
        },
        requests: {
          active: metrics.requests.active,
          total: metrics.requests.total,
          errors: metrics.requests.errors,
          errorRate:
            metrics.requests.total > 0
              ? ((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2) + '%'
              : '0%',
        },
      },
      uptime: {
        server: formatUptime(process.uptime()),
        process: formatUptime(metrics.uptime),
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Performans durumu alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Performans durumu alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

// Çalışma süresini formatla
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * @swagger
 * /api/performance/test/cpu:
 *   get:
 *     summary: CPU yoğun işlem testi
 *     description: CPU yoğun bir işlem gerçekleştirerek performans ölçümü yapar
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: intensity
 *         in: query
 *         description: İşlem yoğunluğu (varsayılan 1000000)
 *         schema:
 *           type: integer
 *           default: 1000000
 *     responses:
 *       200:
 *         description: Test başarıyla tamamlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: number
 *                     duration:
 *                       type: number
 *                     intensity:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/api/performance/test/cpu',
  requireAuth,
  createRouteHandler(async (req, res) => {
    try {
      // İşlem yoğunluğunu al
      const intensity = req.query['intensity']
        ? parseInt(req.query['intensity'] as string)
        : 1000000;

      // CPU yoğun işlemi ölç
      const result = measureSync(
        function () {
          let sum = 0;
          for (let i = 0; i < intensity; i++) {
            sum += Math.sqrt(i);
          }
          return sum;
        },
        'CPU yoğun işlem testi',
        PerformanceMetricType.FUNCTION_EXECUTION,
        { intensity }
      );

      return res.json({
        success: true,
        data: {
          result: result.result,
          duration: result.duration,
          intensity,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('CPU yoğun işlem testi sırasında hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw createError('server', 'CPU yoğun işlem testi sırasında hata oluştu');
    }
  })
);

/**
 * Bellek yoğun işlem testi
 */
router.get('/api/performance/test/memory', requireAuth, (req: Request, res: Response) => {
  try {
    // İşlem yoğunluğunu al
    const size = req.query['size'] ? parseInt(req.query['size'] as string) : 1000000;

    // Bellek yoğun işlemi ölç
    // Geçici olarak mock veri kullanıyoruz
    const result = {
      result: size,
      duration: 100,
      metrics: {
        heapUsed: 1024 * 1024 * 10,
        heapTotal: 1024 * 1024 * 20,
      },
    };

    res.json({
      result,
      size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Bellek yoğun işlem testi sırasında hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: 'Bellek yoğun işlem testi sırasında hata oluştu',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
});

/**
 * @swagger
 * /api/performance/test/async:
 *   get:
 *     summary: Asenkron işlem testi
 *     description: Asenkron bir işlem gerçekleştirerek performans ölçümü yapar
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: delay
 *         in: query
 *         description: Gecikme süresi (ms) (varsayılan 1000)
 *         schema:
 *           type: integer
 *           default: 1000
 *     responses:
 *       200:
 *         description: Test başarıyla tamamlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: string
 *                     duration:
 *                       type: number
 *                     delay:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/api/performance/test/async',
  requireAuth,
  createRouteHandler(async (req, res) => {
    try {
      // Gecikme süresini al
      const delay = req.query['delay'] ? parseInt(req.query['delay'] as string) : 1000;

      // Asenkron işlemi ölç
      const result = await measure(
        async function () {
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              resolve('Asenkron işlem tamamlandı');
            }, delay);
          });
        },
        'Asenkron işlem testi',
        PerformanceMetricType.FUNCTION_EXECUTION,
        { delay }
      );

      return res.json({
        success: true,
        data: {
          result: result.result,
          duration: result.duration,
          delay,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Asenkron işlem testi sırasında hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw createError('server', 'Asenkron işlem testi sırasında hata oluştu');
    }
  })
);

export default router;
