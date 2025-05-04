/**
 * src/routes/api/diagnostics.ts
 * Sistem tanılama API'leri
 */
import express from 'express';
import { createRouteHandler } from '../../utils/routeHandler';
import { requireAuth, requireAdmin } from '../../middleware/authMiddleware';
import { getErrorMetrics } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { formatMemoryUsage } from '../../utils/performanceMonitoring';
import database from '../../config/database';
import { getAppInitState } from '../../app';

const router = express.Router();

/**
 * @swagger
 * /api/diagnostics/errors:
 *   get:
 *     summary: Hata metriklerini getirir
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hata metrikleri
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
 *                     counts:
 *                       type: object
 *                       additionalProperties:
 *                         type: number
 *                     lastErrors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           message:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           path:
 *                             type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Yetkilendirme hatası
 *       403:
 *         description: Yetkisiz erişim
 */
router.get('/errors', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    const metrics = getErrorMetrics();

    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Hata metrikleri getirme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Hata metrikleri getirilirken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

/**
 * @swagger
 * /api/diagnostics/memory:
 *   get:
 *     summary: Bellek kullanım bilgilerini getirir
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bellek kullanım bilgileri
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
 *                     heapUsed:
 *                       type: string
 *                       example: 45.5 MB
 *                     heapTotal:
 *                       type: string
 *                       example: 60.2 MB
 *                     rss:
 *                       type: string
 *                       example: 85.7 MB
 *                     external:
 *                       type: string
 *                       example: 2.3 MB
 *                     arrayBuffers:
 *                       type: string
 *                       example: 0.5 MB
 *       401:
 *         description: Yetkilendirme hatası
 *       403:
 *         description: Yetkisiz erişim
 */
router.get('/memory', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();

    return res.status(200).json({
      success: true,
      data: {
        heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
        heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
        rss: formatMemoryUsage(memoryUsage.rss),
        external: formatMemoryUsage(memoryUsage.external),
        arrayBuffers: formatMemoryUsage(memoryUsage.arrayBuffers || 0)
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
 * @swagger
 * /api/diagnostics/database:
 *   get:
 *     summary: Veritabanı sağlık durumunu getirir
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Veritabanı sağlık durumu
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
 *                     isConnected:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: string
 *                       example: connected
 *                     responseTime:
 *                       type: number
 *                       example: 45
 *                     collections:
 *                       type: number
 *                       example: 12
 *                     connectionState:
 *                       type: object
 *                       properties:
 *                         isConnecting:
 *                           type: boolean
 *                         connectAttempts:
 *                           type: number
 *                         lastConnectAttempt:
 *                           type: number
 *       401:
 *         description: Yetkilendirme hatası
 *       403:
 *         description: Yetkisiz erişim
 */
router.get('/database', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Veritabanı sağlık durumunu kontrol et
    const healthData = await database.checkDatabaseHealth();

    return res.status(200).json({
      success: true,
      data: {
        ...healthData,
        connectionState: {
          isConnecting: database.connectionState.isConnecting,
          connectAttempts: database.connectionState.connectAttempts,
          lastConnectAttempt: database.connectionState.lastConnectAttempt,
          maxConnectAttempts: database.connectionState.maxConnectAttempts
        }
      }
    });
  } catch (error) {
    logger.error('Veritabanı sağlık durumu getirme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Veritabanı sağlık durumu getirilirken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

/**
 * @swagger
 * /api/diagnostics/app-state:
 *   get:
 *     summary: Uygulama durumunu getirir
 *     tags: [Diagnostics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Uygulama durumu
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
 *                     isInitialized:
 *                       type: boolean
 *                       example: true
 *                     isInitializing:
 *                       type: boolean
 *                       example: false
 *                     uptime:
 *                       type: number
 *                       example: 3600000
 *                     initSteps:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: boolean
 *                           example: true
 *                         mediasoup:
 *                           type: boolean
 *                           example: true
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           step:
 *                             type: string
 *                             example: database
 *                           error:
 *                             type: string
 *                             example: Connection failed
 *       401:
 *         description: Yetkilendirme hatası
 *       403:
 *         description: Yetkisiz erişim
 */
router.get('/app-state', requireAuth, requireAdmin(), createRouteHandler(async (req, res) => {
  try {
    // Uygulama durumunu al
    const appState = getAppInitState();

    return res.status(200).json({
      success: true,
      data: appState
    });
  } catch (error) {
    logger.error('Uygulama durumu getirme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Uygulama durumu getirilirken bir hata oluştu',
        type: 'ServerError'
      }
    });
  }
}));

export default router;
