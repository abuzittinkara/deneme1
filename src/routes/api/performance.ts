/**
 * src/routes/api/performance.ts
 * Performans izleme API endpoint'leri
 */
import express from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireAdmin } from '../../middleware/authorizationMiddleware';
import { generatePerformanceReport, getRecentMeasurements } from '../../utils/performanceMonitor';
import { getMemoryUsage, formatMemoryUsage } from '../../utils/memoryOptimizer';
import { logger } from '../../utils/logger';
import { createRouteHandler } from '../../utils/express-helpers';

const router = express.Router();

/**
 * @route   GET /api/performance/report
 * @desc    Performans raporu getirir
 * @access  Admin
 */
router.get('/report', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Performans raporu oluştur
    const report = generatePerformanceReport();

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Performans raporu oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Performans raporu oluşturulurken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

/**
 * @route   GET /api/performance/measurements
 * @desc    Son performans ölçümlerini getirir
 * @access  Admin
 */
router.get('/measurements', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Limit parametresini al
    const limit = parseInt(req.query.limit as string || '100');

    // Son ölçümleri getir
    const measurements = getRecentMeasurements(limit);

    return res.status(200).json({
      success: true,
      data: measurements
    });
  } catch (error) {
    logger.error('Performans ölçümleri getirme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Performans ölçümleri getirilirken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

/**
 * @route   GET /api/performance/memory
 * @desc    Bellek kullanımını getirir
 * @access  Admin
 */
router.get('/memory', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Bellek kullanımını al
    const memoryUsage = getMemoryUsage();

    // Formatlanmış bellek kullanımı
    const formattedMemoryUsage = {
      rss: formatMemoryUsage(memoryUsage.rss),
      heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
      heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
      external: formatMemoryUsage(memoryUsage.external),
      arrayBuffers: formatMemoryUsage(memoryUsage.arrayBuffers)
    };

    return res.status(200).json({
      success: true,
      data: {
        raw: memoryUsage,
        formatted: formattedMemoryUsage
      }
    });
  } catch (error) {
    logger.error('Bellek kullanımı getirme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Bellek kullanımı getirilirken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

/**
 * @route   POST /api/performance/gc
 * @desc    Çöp toplama işlemini zorlar (--expose-gc ile çalıştırılmalı)
 * @access  Admin
 */
router.post('/gc', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Bellek kullanımını al (öncesi)
    const memoryBefore = getMemoryUsage();

    // Çöp toplama işlemini zorla
    if (global.gc) {
      global.gc();

      // Bellek kullanımını al (sonrası)
      const memoryAfter = getMemoryUsage();

      // Bellek kazancını hesapla
      const memoryGain = {
        heapTotal: memoryBefore.heapTotal - memoryAfter.heapTotal,
        heapUsed: memoryBefore.heapUsed - memoryAfter.heapUsed
      };

      return res.status(200).json({
        success: true,
        data: {
          before: {
            heapTotal: formatMemoryUsage(memoryBefore.heapTotal),
            heapUsed: formatMemoryUsage(memoryBefore.heapUsed)
          },
          after: {
            heapTotal: formatMemoryUsage(memoryAfter.heapTotal),
            heapUsed: formatMemoryUsage(memoryAfter.heapUsed)
          },
          gain: {
            heapTotal: formatMemoryUsage(memoryGain.heapTotal),
            heapUsed: formatMemoryUsage(memoryGain.heapUsed)
          }
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Çöp toplama işlemi zorlanamıyor. Node.js\'i --expose-gc parametresi ile başlatın',
          type: 'BadRequestError'
        }
      });
    }
  } catch (error) {
    logger.error('Çöp toplama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Çöp toplama işlemi sırasında bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

export default router;
