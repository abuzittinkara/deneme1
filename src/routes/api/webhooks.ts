/**
 * src/routes/api/webhooks.ts
 * Webhook API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as webhookManager from '../../modules/webhookManager';
import { WebhookEvent } from '../../models/Webhook';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const router = express.Router();

/**
 * @route   GET /api/webhooks
 * @desc    Webhook'ları getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  [
    query('groupId').optional().isString().withMessage('Geçersiz grup ID'),
    query('channelId').optional().isString().withMessage('Geçersiz kanal ID'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive parametresi boolean olmalıdır')
      .toBoolean(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { groupId, channelId, isActive } = req.query;
      const userId = req.user!.id;

      // Webhook'ları getir
      const webhooks = await webhookManager.getWebhooks({
        userId,
        groupId: groupId as string,
        channelId: channelId as string,
        isActive:
          typeof isActive === 'string'
            ? isActive === 'true'
            : typeof isActive === 'boolean'
              ? isActive
              : undefined,
      });

      return res.status(200).json({
        success: true,
        count: webhooks.length,
        data: webhooks,
      });
    } catch (error) {
      logger.error('Webhook\'ları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        query: req.query,
      });
      return res.status(500).json({
        success: false,
        message: 'Webhook\'lar getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/webhooks
 * @desc    Webhook oluşturur
 * @access  Private
 */
router.post(
  '/',
  requireAuth,
  [
    body('name').isString().notEmpty().withMessage('Webhook adı gereklidir').trim(),
    body('url').isURL().withMessage('Geçerli bir URL girilmelidir'),
    body('events').isArray({ min: 1 }).withMessage('En az bir event seçilmelidir'),
    body('events.*').isIn(Object.values(WebhookEvent)).withMessage('Geçersiz event türü'),
    body('groupId').optional().isString().withMessage('Geçersiz grup ID'),
    body('channelId').optional().isString().withMessage('Geçersiz kanal ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { name, url, events, groupId, channelId } = req.body;
      const userId = req.user!.id;

      // Webhook oluştur
      const webhook = await webhookManager.createWebhook({
        name,
        url,
        events,
        groupId,
        channelId,
        userId,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: webhook._id,
          name: webhook.name,
          url: webhook.url,
          secret: webhook.secret,
          events: webhook.events,
          group: webhook.group,
          channel: webhook.channel,
          createdAt: webhook.createdAt,
        },
      });
    } catch (error) {
      logger.error('Webhook oluşturma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        body: req.body,
      });

      // Hata mesajını belirle
      let message = 'Webhook oluşturulurken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      } else if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   GET /api/webhooks/:id
 * @desc    Webhook detaylarını getirir
 * @access  Private
 */
router.get(
  '/:id',
  requireAuth,
  [param('id').isMongoId().withMessage('Geçersiz webhook ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const webhookId = req.params['id'] || '';
      const userId = req.user!.id;

      // Webhook'u getir
      const webhook = await webhookManager.Webhook.findOne({
        _id: webhookId,
        createdBy: userId,
      })
        .populate('createdBy', 'username')
        .populate('group', 'groupId name')
        .populate('channel', 'channelId name');

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook bulunamadı',
        });
      }

      return res.status(200).json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      logger.error('Webhook detaylarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        webhookId: req.params['id'],
      });
      return res.status(500).json({
        success: false,
        message: 'Webhook detayları getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   PATCH /api/webhooks/:id
 * @desc    Webhook'u günceller
 * @access  Private
 */
router.patch(
  '/:id',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Geçersiz webhook ID'),
    body('name').optional().isString().notEmpty().withMessage('Webhook adı boş olamaz').trim(),
    body('url').optional().isURL().withMessage('Geçerli bir URL girilmelidir'),
    body('events').optional().isArray({ min: 1 }).withMessage('En az bir event seçilmelidir'),
    body('events.*')
      .optional()
      .isIn(Object.values(WebhookEvent))
      .withMessage('Geçersiz event türü'),
    body('isActive').optional().isBoolean().withMessage('isActive parametresi boolean olmalıdır'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const webhookId = req.params['id'] || '';
      const userId = req.user!.id;
      const { name, url, events, isActive } = req.body;

      // Webhook'un kullanıcıya ait olduğunu kontrol et
      const webhook = await webhookManager.Webhook.findOne({
        _id: webhookId,
        createdBy: userId,
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook bulunamadı',
        });
      }

      // Webhook'u güncelle
      const updatedWebhook = await webhookManager.updateWebhook(webhookId, {
        name,
        url,
        events,
        isActive,
      });

      return res.status(200).json({
        success: true,
        data: updatedWebhook,
      });
    } catch (error) {
      logger.error('Webhook güncelleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        webhookId: req.params['id'],
        body: req.body,
      });

      // Hata mesajını belirle
      let message = 'Webhook güncellenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      } else if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   DELETE /api/webhooks/:id
 * @desc    Webhook'u siler
 * @access  Private
 */
router.delete(
  '/:id',
  requireAuth,
  [param('id').isMongoId().withMessage('Geçersiz webhook ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const webhookId = req.params['id'] || '';
      const userId = req.user!.id;

      // Webhook'un kullanıcıya ait olduğunu kontrol et
      const webhook = await webhookManager.Webhook.findOne({
        _id: webhookId,
        createdBy: userId,
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook bulunamadı',
        });
      }

      // Webhook'u sil
      await webhookManager.deleteWebhook(webhookId);

      return res.status(200).json({
        success: true,
        message: 'Webhook silindi',
      });
    } catch (error) {
      logger.error('Webhook silme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        webhookId: req.params['id'],
      });
      return res.status(500).json({
        success: false,
        message: 'Webhook silinirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/webhooks/:id/regenerate-secret
 * @desc    Webhook secret'ını yeniler
 * @access  Private
 */
router.post(
  '/:id/regenerate-secret',
  requireAuth,
  [param('id').isMongoId().withMessage('Geçersiz webhook ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const webhookId = req.params['id'] || '';
      const userId = req.user!.id;

      // Webhook'un kullanıcıya ait olduğunu kontrol et
      const webhook = await webhookManager.Webhook.findOne({
        _id: webhookId,
        createdBy: userId,
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook bulunamadı',
        });
      }

      // Yeni secret oluştur
      const secret = webhookManager.createSignature(
        crypto.randomBytes(16).toString('hex'),
        Date.now().toString(),
        crypto.randomBytes(16).toString('hex')
      );

      // Webhook'u güncelle
      webhook.secret = secret;
      await webhook.save();

      return res.status(200).json({
        success: true,
        data: {
          secret,
        },
      });
    } catch (error) {
      logger.error('Webhook secret yenileme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        webhookId: req.params['id'],
      });
      return res.status(500).json({
        success: false,
        message: 'Webhook secret\'ı yenilenirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/webhooks/:id/test
 * @desc    Webhook'u test eder
 * @access  Private
 */
router.post(
  '/:id/test',
  requireAuth,
  [param('id').isMongoId().withMessage('Geçersiz webhook ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const webhookId = req.params['id'] || '';
      const userId = req.user!.id;

      // Webhook'un kullanıcıya ait olduğunu kontrol et
      const webhook = await webhookManager.Webhook.findOne({
        _id: webhookId,
        createdBy: userId,
      });

      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook bulunamadı',
        });
      }

      // Test payload'ı oluştur
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Bu bir test mesajıdır',
          user: {
            id: userId,
            username: req.user!.username,
          },
        },
      };

      // Webhook'u tetikle
      const result = await webhookManager.triggerWebhooks({
        event: 'test',
        payload: testPayload,
      });

      return res.status(200).json({
        success: true,
        message: `Webhook test edildi (${result.triggeredCount} webhook tetiklendi)`,
      });
    } catch (error) {
      logger.error('Webhook test hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        webhookId: req.params['id'],
      });
      return res.status(500).json({
        success: false,
        message: 'Webhook test edilirken bir hata oluştu',
      });
    }
  })
);

export default router;
