/**
 * src/routes/errors.ts
 * Hata izleme ve analiz rotaları
 */
import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getErrorStats } from '../utils/errorReporter';
import { createError } from '../utils/appError';
import { env } from '../config/env';
import { createRouteHandler } from '../utils/express-helpers';

// Router oluştur
const router = express.Router();

/**
 * @swagger
 * /api/errors/stats:
 *   get:
 *     summary: Hata istatistiklerini getirir
 *     description: Sistemdeki hata istatistiklerini döndürür
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hata istatistikleri başarıyla alındı
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
 *                     totalErrors:
 *                       type: integer
 *                       example: 120
 *                     uniqueErrors:
 *                       type: integer
 *                       example: 15
 *                     errorGroups:
 *                       type: array
 *                       items:
 *                         type: object
 *                     topErrors:
 *                       type: array
 *                       items:
 *                         type: object
 *                     lastHourErrors:
 *                       type: integer
 *                       example: 5
 *                     errorCountLastMinute:
 *                       type: integer
 *                       example: 1
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/api/errors/stats',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    try {
      // Hata istatistiklerini al
      const stats = await getErrorStats();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Hata istatistikleri alınırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw createError('server', 'Hata istatistikleri alınırken hata oluştu');
    }
  })
);

/**
 * @swagger
 * /api/errors/clear-cache:
 *   post:
 *     summary: Hata önbelleğini temizler
 *     description: Hata istatistikleri önbelleğini temizler
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hata önbelleği başarıyla temizlendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Hata önbelleği temizlendi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/api/errors/clear-cache',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    try {
      // Redis önbelleğini temizle
      // Not: Bu işlev henüz uygulanmadı, Redis yapılandırmasına bağlı olarak uygulanacak

      return res.json({
        success: true,
        message: 'Hata önbelleği temizlendi',
      });
    } catch (error) {
      logger.error('Hata önbelleği temizlenirken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw createError('server', 'Hata önbelleği temizlenirken hata oluştu');
    }
  })
);

/**
 * @swagger
 * /api/errors/test:
 *   post:
 *     summary: Test hatası oluşturur
 *     description: Belirtilen türde test hatası oluşturur (sadece geliştirme modunda)
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [validation, database, authentication, authorization, notfound, timeout, server, badrequest]
 *                 description: Hata türü
 *                 example: validation
 *               message:
 *                 type: string
 *                 description: Hata mesajı
 *                 example: Test validation error
 *     responses:
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/api/errors/test',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    // Sadece geliştirme modunda çalışır
    if (!env.isDevelopment) {
      throw createError('authorization', 'Bu endpoint sadece geliştirme modunda kullanılabilir');
    }

    // Hata türünü al
    const errorType = req.body.type || 'server';

    // Hata mesajını al
    const errorMessage = req.body.message || 'Test hatası';

    // Hata oluştur
    logger.info('Test hatası oluşturuluyor', {
      type: errorType,
      message: errorMessage,
    });

    // createError fonksiyonu ile hata oluştur
    throw createError(errorType, errorMessage, { test: true });
  })
);

export default router;
