/**
 * src/routes/atlasSQL.ts
 * MongoDB Atlas SQL API rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { atlasSQLService } from '../services/atlasSQLService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/errors';
import { createRouteHandler } from '../utils/express-helpers';
import { validateSchema } from '../middleware/validationMiddleware';
import { env } from '../config/env';
import Joi from 'joi';

const router = express.Router();

/**
 * @swagger
 * /api/atlas-sql/status:
 *   get:
 *     summary: Atlas SQL bağlantı durumunu kontrol eder
 *     tags: [Atlas SQL]
 *     responses:
 *       200:
 *         description: Bağlantı durumu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isConnected:
 *                   type: boolean
 *                 database:
 *                   type: string
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get(
  '/status',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    const status = await atlasSQLService.checkConnection();
    return res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * @swagger
 * /api/atlas-sql/schema:
 *   get:
 *     summary: Atlas SQL veritabanı şemasını getirir
 *     tags: [Atlas SQL]
 *     responses:
 *       200:
 *         description: Veritabanı şeması
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get(
  '/schema',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
    const schema = await atlasSQLService.getSchema();
    return res.json({
      success: true,
      data: schema,
    });
  })
);

// SQL sorgusu çalıştırma şeması
const sqlQuerySchema = Joi.object({
  query: Joi.string().required().min(1).max(10000),
});

/**
 * @swagger
 * /api/atlas-sql/query:
 *   post:
 *     summary: SQL sorgusu çalıştırır
 *     tags: [Atlas SQL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: SQL sorgusu
 *     responses:
 *       200:
 *         description: Sorgu sonuçları
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 */
router.post(
  '/query',
  requireAuth,
  requireAdmin,
  validateSchema(sqlQuerySchema),
  asyncHandler(async (req, res) => {
    const { query } = req.body;

    // Sorgu güvenliği kontrolü
    if (
      query.toLowerCase().includes('drop') ||
      query.toLowerCase().includes('delete') ||
      query.toLowerCase().includes('update') ||
      query.toLowerCase().includes('insert')
    ) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Sadece SELECT sorguları desteklenmektedir',
          code: 'FORBIDDEN_QUERY',
        },
      });
    }

    logger.info('SQL sorgusu çalıştırılıyor', {
      query,
      userId: req.user?.id || 'anonymous',
    });

    const startTime = Date.now();
    const results = await atlasSQLService.executeSQL(query);
    const duration = Date.now() - startTime;

    logger.info('SQL sorgusu tamamlandı', {
      query,
      duration: `${duration}ms`,
      resultCount: results.length,
    });

    return res.json({
      success: true,
      data: results,
      meta: {
        executionTime: duration,
        rowCount: results.length,
      },
    });
  })
);

/**
 * @swagger
 * /api/atlas-sql/connect:
 *   post:
 *     summary: Atlas SQL bağlantısını açar
 *     tags: [Atlas SQL]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Başarılı
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
 *                   example: "Atlas SQL bağlantısı açıldı"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/connect',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
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

      await atlasSQLService.connect();

      return res.json({
        success: true,
        message: 'Atlas SQL bağlantısı açıldı',
      });
    } catch (error) {
      logger.error('Atlas SQL bağlantısı açılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  })
);

/**
 * @swagger
 * /api/atlas-sql/disconnect:
 *   post:
 *     summary: Atlas SQL bağlantısını kapatır
 *     tags: [Atlas SQL]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Başarılı
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
 *                   example: "Atlas SQL bağlantısı kapatıldı"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/disconnect',
  requireAuth,
  requireAdmin,
  createRouteHandler(async (req, res) => {
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

      await atlasSQLService.disconnect();

      return res.json({
        success: true,
        message: 'Atlas SQL bağlantısı kapatıldı',
      });
    } catch (error) {
      logger.error('Atlas SQL bağlantısı kapatılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  })
);

export default router;
