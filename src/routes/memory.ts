/**
 * src/routes/memory.ts
 * Bellek izleme rotaları
 */
import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  getMemoryStats,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  logMemoryUsage,
} from '../utils/memoryOptimizer';
import { env } from '../config/env';

// Router oluştur
const router = express.Router();

/**
 * Bellek istatistiklerini getirir
 */
router.get('/api/memory/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Bellek istatistiklerini al
    const stats = await getMemoryStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Bellek istatistikleri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Bellek istatistikleri alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

/**
 * Bellek izlemeyi başlatır
 */
router.post(
  '/api/memory/start-monitoring',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      startMemoryMonitoring();

      res.json({
        success: true,
        message: 'Bellek izleme başlatıldı',
      });
    } catch (error) {
      logger.error('Bellek izleme başlatılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Bellek izleme başlatılırken hata oluştu',
          details: error instanceof Error ? error.message : 'Bilinmeyen hata',
        },
      });
    }
  }
);

/**
 * Bellek izlemeyi durdurur
 */
router.post(
  '/api/memory/stop-monitoring',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      stopMemoryMonitoring();

      res.json({
        success: true,
        message: 'Bellek izleme durduruldu',
      });
    } catch (error) {
      logger.error('Bellek izleme durdurulurken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Bellek izleme durdurulurken hata oluştu',
          details: error instanceof Error ? error.message : 'Bilinmeyen hata',
        },
      });
    }
  }
);

/**
 * Garbage collection'ı zorlar (sadece geliştirme modunda)
 */
router.post('/api/memory/force-gc', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    // Sadece geliştirme modunda çalışır
    if (!env.isDevelopment) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Bu endpoint sadece geliştirme modunda kullanılabilir',
          code: 'DEVELOPMENT_ONLY',
        },
      });
    }

    // Garbage collection'ı zorla
    if (global.gc) {
      global.gc();

      // Bellek kullanımını logla
      const memUsage = logMemoryUsage();
      const memoryUsageData = process.memoryUsage();

      res.json({
        success: true,
        message: 'Garbage collection zorlandı',
        memoryUsage: {
          rss: memoryUsageData.rss,
          heapTotal: memoryUsageData.heapTotal,
          heapUsed: memoryUsageData.heapUsed,
          external: memoryUsageData.external,
          arrayBuffers: memoryUsageData.arrayBuffers || 0,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          message:
            'Garbage collection kullanılamıyor. Node.js\'i --expose-gc parametresi ile başlatın',
          code: 'GC_NOT_AVAILABLE',
        },
      });
    }
  } catch (error) {
    logger.error('Garbage collection zorlanırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Garbage collection zorlanırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

/**
 * Heap snapshot oluşturur (sadece geliştirme modunda)
 */
router.post(
  '/api/memory/heap-snapshot',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      // Sadece geliştirme modunda çalışır
      if (!env.isDevelopment) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Bu endpoint sadece geliştirme modunda kullanılabilir',
            code: 'DEVELOPMENT_ONLY',
          },
        });
      }

      // Heap snapshot oluştur
      const fs = require('fs');
      const path = require('path');
      const v8 = require('v8');

      // Heap snapshot dizini oluştur
      const snapshotDir = path.join(process.cwd(), 'logs', 'heapdump');
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }

      // Heap snapshot dosya adı
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const snapshotPath = path.join(snapshotDir, `heapdump-${timestamp}.heapsnapshot`);

      logger.info(`Heap snapshot oluşturuluyor: ${snapshotPath}`);

      // Heap snapshot oluştur
      const snapshot = v8.getHeapSnapshot();
      const fileStream = fs.createWriteStream(snapshotPath);

      snapshot.pipe(fileStream);

      fileStream.on('finish', () => {
        logger.info(`Heap snapshot oluşturuldu: ${snapshotPath}`);
      });

      res.json({
        success: true,
        message: 'Heap snapshot oluşturuluyor',
        path: snapshotPath,
      });
    } catch (error) {
      logger.error('Heap snapshot oluşturulurken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Heap snapshot oluşturulurken hata oluştu',
          details: error instanceof Error ? error.message : 'Bilinmeyen hata',
        },
      });
    }
  }
);

export default router;
