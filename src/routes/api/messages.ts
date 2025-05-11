/**
 * src/routes/api/messages.ts
 * Mesaj API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as messageManager from '../../modules/message/messageManager';
import * as searchManager from '../../modules/message/searchManager';
import * as unreadManager from '../../modules/message/unreadManager';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/messages/channel/:channelId
 * @desc    Kanal mesajlarını getirir
 * @access  Private
 */
router.get(
  '/channel/:channelId',
  requireAuth,
  [
    param('channelId').isString().withMessage('Geçersiz kanal ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('before').optional().isMongoId().withMessage('Geçersiz mesaj ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const channelId = req.params['channelId'] || '';
      const { limit = 50, before } = req.query;
      const userId = req.user!.id;

      const messages = await messageManager.getChannelMessages(channelId, { limit: Number(limit) });

      return res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error) {
      logger.error('Kanal mesajlarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
      });
      return res.status(500).json({
        success: false,
        message: 'Mesajlar getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/messages/channel/:channelId
 * @desc    Kanala mesaj gönderir
 * @access  Private
 */
router.post(
  '/channel/:channelId',
  requireAuth,
  [
    param('channelId').isString().withMessage('Geçersiz kanal ID'),
    body('content').isString().notEmpty().withMessage('Mesaj içeriği gereklidir').trim(),
    body('quotedMessageId').optional().isMongoId().withMessage('Geçersiz alıntılanan mesaj ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const channelId = req.params['channelId'] || '';
      const { content, quotedMessageId } = req.body;
      const userId = req.user!.id;

      const message = await messageManager.sendChannelMessage(channelId, userId, content);

      return res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Mesaj gönderme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
      });
      return res.status(500).json({
        success: false,
        message: 'Mesaj gönderilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   PUT /api/messages/:messageId
 * @desc    Mesajı düzenler
 * @access  Private
 */
router.put(
  '/:messageId',
  requireAuth,
  [
    param('messageId').isMongoId().withMessage('Geçersiz mesaj ID'),
    body('content').isString().notEmpty().withMessage('Mesaj içeriği gereklidir').trim(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const messageId = req.params['messageId'] || '';
      const { content } = req.body;
      const userId = req.user!.id;

      const message = await messageManager.editChannelMessage(messageId, content, userId);

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Mesaj düzenleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        messageId: req.params['messageId'],
      });

      // Hata mesajını belirle
      let message = 'Mesaj düzenlenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Mesajı siler
 * @access  Private
 */
router.delete(
  '/:messageId',
  requireAuth,
  [param('messageId').isMongoId().withMessage('Geçersiz mesaj ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const messageId = req.params['messageId'] || '';
      const userId = req.user!.id;

      const message = await messageManager.deleteChannelMessage(messageId, userId);

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Mesaj silme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        messageId: req.params['messageId'],
      });

      // Hata mesajını belirle
      let message = 'Mesaj silinirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   POST /api/messages/:messageId/pin
 * @desc    Mesajı sabitler
 * @access  Private
 */
router.post(
  '/:messageId/pin',
  requireAuth,
  [param('messageId').isMongoId().withMessage('Geçersiz mesaj ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const messageId = req.params['messageId'] || '';
      const userId = req.user!.id;

      const message = await messageManager.pinMessage(messageId, userId);

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Mesaj sabitleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        messageId: req.params['messageId'],
      });

      // Hata mesajını belirle
      let message = 'Mesaj sabitlenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   DELETE /api/messages/:messageId/pin
 * @desc    Mesaj sabitlemesini kaldırır
 * @access  Private
 */
router.delete(
  '/:messageId/pin',
  requireAuth,
  [param('messageId').isMongoId().withMessage('Geçersiz mesaj ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const messageId = req.params['messageId'] || '';
      const userId = req.user!.id;

      const message = await messageManager.unpinMessage(messageId, userId);

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Mesaj sabitleme kaldırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        messageId: req.params['messageId'],
      });

      // Hata mesajını belirle
      let message = 'Mesaj sabitlemesi kaldırılırken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Okunmamış mesaj sayısını getirir
 * @access  Private
 */
router.get(
  '/unread/count',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const unreadCount = await unreadManager.getUnreadMessageCount(userId);

      return res.status(200).json({
        success: true,
        data: unreadCount,
      });
    } catch (error) {
      logger.error('Okunmamış mesaj sayısı getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res.status(500).json({
        success: false,
        message: 'Okunmamış mesaj sayısı getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/messages/unread
 * @desc    Okunmamış mesajları getirir
 * @access  Private
 */
router.get(
  '/unread',
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { limit = 50 } = req.query;
      const userId = req.user!.id;

      const unreadMessages = await unreadManager.getUnreadMessages(userId, Number(limit));

      return res.status(200).json({
        success: true,
        data: unreadMessages,
      });
    } catch (error) {
      logger.error('Okunmamış mesajları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res.status(500).json({
        success: false,
        message: 'Okunmamış mesajlar getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/messages/:messageId/read
 * @desc    Mesajı okundu olarak işaretler
 * @access  Private
 */
router.post(
  '/:messageId/read',
  requireAuth,
  [
    param('messageId').isMongoId().withMessage('Geçersiz mesaj ID'),
    body('type').isIn(['channel', 'direct']).withMessage('Geçersiz mesaj türü'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const messageId = req.params['messageId'] || '';
      const { type } = req.body;
      const userId = req.user!.id;

      if (type === 'channel') {
        await unreadManager.markChannelMessageAsRead(messageId, userId);
      } else {
        await unreadManager.markDirectMessageAsRead(messageId, userId);
      }

      return res.status(200).json({
        success: true,
        message: 'Mesaj okundu olarak işaretlendi',
      });
    } catch (error) {
      logger.error('Mesajı okundu olarak işaretleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        messageId: req.params['messageId'],
      });
      return res.status(500).json({
        success: false,
        message: 'Mesaj okundu olarak işaretlenirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/messages/channel/:channelId/read-all
 * @desc    Kanaldaki tüm mesajları okundu olarak işaretler
 * @access  Private
 */
router.post(
  '/channel/:channelId/read-all',
  requireAuth,
  [param('channelId').isString().withMessage('Geçersiz kanal ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const channelId = req.params['channelId'] || '';
      const userId = req.user!.id;

      const count = await unreadManager.markAllChannelMessagesAsRead(channelId, userId);

      return res.status(200).json({
        success: true,
        message: `${count} mesaj okundu olarak işaretlendi`,
      });
    } catch (error) {
      logger.error('Kanaldaki tüm mesajları okundu olarak işaretleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
      });
      return res.status(500).json({
        success: false,
        message: 'Mesajlar okundu olarak işaretlenirken bir hata oluştu',
      });
    }
  })
);

export default router;
