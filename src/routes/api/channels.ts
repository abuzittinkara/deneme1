/**
 * src/routes/api/channels.ts
 * Kanal API endpoint'leri
 */
import express from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import * as channelManager from '../../modules/channel/channelManager';
import * as messageManager from '../../modules/message/messageManager';
import { logger } from '../../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../../types/api';

const router = express.Router();

/**
 * @route   GET /api/channels/:channelId
 * @desc    Kanal detaylarını getirir
 * @access  Private
 */
router.get(
  '/:channelId',
  requireAuth,
  [param('channelId').isMongoId().withMessage('Geçersiz kanal ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { channelId } = req.params;

      const channel = await channelManager.getChannelDetails(channelId, userId);

      return res.status(200).json(createSuccessResponse(channel));
    } catch (error) {
      logger.error('Kanal detayları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
      });

      // Hata mesajını belirle
      let message = 'Kanal detayları getirilirken bir hata oluştu';
      let code = 'CHANNEL_FETCH_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'CHANNEL_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'NOT_AUTHORIZED';
        statusCode = 403;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   PATCH /api/channels/:channelId
 * @desc    Kanal bilgilerini günceller
 * @access  Private
 */
router.patch(
  '/:channelId',
  requireAuth,
  [
    param('channelId').isMongoId().withMessage('Geçersiz kanal ID'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('Kanal adı 3-50 karakter arasında olmalıdır')
      .trim(),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Kanal açıklaması en fazla 500 karakter olabilir')
      .trim(),
    body('isPrivate').optional().isBoolean().withMessage('isPrivate bir boolean değer olmalıdır'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const channelId = req.params['channelId'] || '';
      const updates = req.body;

      const updatedChannel = await channelManager.updateChannel(channelId, updates, userId);

      return res
        .status(200)
        .json(createSuccessResponse(updatedChannel, 'Kanal başarıyla güncellendi'));
    } catch (error) {
      logger.error('Kanal güncelleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
        updates: req.body,
      });

      // Hata mesajını belirle
      let message = 'Kanal güncellenirken bir hata oluştu';
      let code = 'CHANNEL_UPDATE_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'CHANNEL_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'NOT_AUTHORIZED';
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   DELETE /api/channels/:channelId
 * @desc    Kanalı siler
 * @access  Private
 */
router.delete(
  '/:channelId',
  requireAuth,
  [param('channelId').isMongoId().withMessage('Geçersiz kanal ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const channelId = req.params['channelId'] || '';

      await channelManager.deleteChannel(channelId, userId);

      return res.status(200).json(createSuccessResponse(null, 'Kanal başarıyla silindi'));
    } catch (error) {
      logger.error('Kanal silme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
      });

      // Hata mesajını belirle
      let message = 'Kanal silinirken bir hata oluştu';
      let code = 'CHANNEL_DELETE_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'CHANNEL_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'NOT_AUTHORIZED';
        statusCode = 403;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   GET /api/channels/:channelId/messages
 * @desc    Kanal mesajlarını getirir
 * @access  Private
 */
router.get(
  '/:channelId/messages',
  requireAuth,
  [
    param('channelId').isMongoId().withMessage('Geçersiz kanal ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('before').optional().isMongoId().withMessage('Geçersiz mesaj ID'),
    query('after').optional().isMongoId().withMessage('Geçersiz mesaj ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const channelId = req.params['channelId'] || '';
      const { limit = 50, before, after } = req.query;

      const messages = await messageManager.getChannelMessages(channelId, { limit: Number(limit) });

      return res.status(200).json(createSuccessResponse(messages));
    } catch (error) {
      logger.error('Kanal mesajlarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
        query: req.query,
      });

      // Hata mesajını belirle
      let message = 'Kanal mesajları getirilirken bir hata oluştu';
      let code = 'MESSAGES_FETCH_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'CHANNEL_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'NOT_AUTHORIZED';
        statusCode = 403;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   POST /api/channels/:channelId/messages
 * @desc    Kanala mesaj gönderir
 * @access  Private
 */
router.post(
  '/:channelId/messages',
  requireAuth,
  [
    param('channelId').isMongoId().withMessage('Geçersiz kanal ID'),
    body('content').isString().notEmpty().withMessage('Mesaj içeriği gereklidir').trim(),
    body('type')
      .optional()
      .isIn(['text', 'image', 'file', 'system'])
      .withMessage('Geçersiz mesaj türü')
      .default('text'),
    body('attachments').optional().isArray().withMessage('Ekler bir dizi olmalıdır'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const channelId = req.params['channelId'] || '';
      const { content, type = 'text', attachments = [] } = req.body;

      // Mesaj oluşturma işlemi
      const message = await messageManager.sendChannelMessage(
        channelId,
        userId,
        content,
        attachments
      );

      return res.status(201).json(createSuccessResponse(message, 'Mesaj başarıyla gönderildi'));
    } catch (error) {
      logger.error('Mesaj gönderme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        channelId: req.params['channelId'],
        content: req.body.content,
      });

      // Hata mesajını belirle
      let message = 'Mesaj gönderilirken bir hata oluştu';
      let code = 'MESSAGE_SEND_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'CHANNEL_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'NOT_AUTHORIZED';
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

export default router;
