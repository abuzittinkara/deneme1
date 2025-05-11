/**
 * src/routes/api/friends.ts
 * Arkadaşlık API endpoint'leri
 */
import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import * as friendManager from '../../modules/friend/friendManager';
import { logger } from '../../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../../types/api';

const router = express.Router();

/**
 * @route   GET /api/friends
 * @desc    Arkadaşları getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  [
    query('status')
      .optional()
      .isIn(['all', 'online', 'offline'])
      .withMessage('Geçersiz durum filtresi'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip 0 veya daha büyük olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { status = 'all', limit = 50, skip = 0 } = req.query;

      const friends = await friendManager.getFriends(
        userId,
        status as string,
        Number(limit),
        Number(skip)
      );

      return res.status(200).json(createSuccessResponse(friends));
    } catch (error) {
      logger.error('Arkadaşları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res
        .status(500)
        .json(
          createErrorResponse('Arkadaşlar getirilirken bir hata oluştu', 'FRIENDS_FETCH_ERROR')
        );
    }
  })
);

/**
 * @route   GET /api/friends/requests
 * @desc    Arkadaşlık isteklerini getirir
 * @access  Private
 */
router.get(
  '/requests',
  requireAuth,
  [
    query('type')
      .optional()
      .isIn(['received', 'sent', 'all'])
      .withMessage('Geçersiz istek türü')
      .default('received'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip 0 veya daha büyük olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { type = 'received', limit = 50, skip = 0 } = req.query;

      const requests = await friendManager.getFriendRequests(
        userId,
        type as string,
        Number(limit),
        Number(skip)
      );

      return res.status(200).json(createSuccessResponse(requests));
    } catch (error) {
      logger.error('Arkadaşlık isteklerini getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res
        .status(500)
        .json(
          createErrorResponse(
            'Arkadaşlık istekleri getirilirken bir hata oluştu',
            'FRIEND_REQUESTS_FETCH_ERROR'
          )
        );
    }
  })
);

/**
 * @route   POST /api/friends/request/:userId
 * @desc    Arkadaşlık isteği gönderir
 * @access  Private
 */
router.post(
  '/request/:userId',
  requireAuth,
  [param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const senderId = req.user!.id;
      const receiverId = req.params['userId'] || '';

      const result = await friendManager.sendFriendRequest(senderId, receiverId);

      return res.status(200).json(createSuccessResponse(result, 'Arkadaşlık isteği gönderildi'));
    } catch (error) {
      logger.error('Arkadaşlık isteği gönderme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        receiverId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Arkadaşlık isteği gönderilirken bir hata oluştu';
      let code = 'FRIEND_REQUEST_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'USER_NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      } else if ((error as any).name === 'FriendshipError') {
        message = (error as Error).message;
        code = 'FRIENDSHIP_ERROR';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   POST /api/friends/accept/:userId
 * @desc    Arkadaşlık isteğini kabul eder
 * @access  Private
 */
router.post(
  '/accept/:userId',
  requireAuth,
  [param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const receiverId = req.user!.id;
      const senderId = req.params['userId'] || '';

      const result = await friendManager.acceptFriendRequest(senderId, receiverId);

      return res.status(200).json(createSuccessResponse(result, 'Arkadaşlık isteği kabul edildi'));
    } catch (error) {
      logger.error('Arkadaşlık isteği kabul etme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        senderId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Arkadaşlık isteği kabul edilirken bir hata oluştu';
      let code = 'FRIEND_ACCEPT_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'REQUEST_NOT_FOUND';
        statusCode = 404;
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
 * @route   POST /api/friends/reject/:userId
 * @desc    Arkadaşlık isteğini reddeder
 * @access  Private
 */
router.post(
  '/reject/:userId',
  requireAuth,
  [param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const receiverId = req.user!.id;
      const senderId = req.params['userId'] || '';

      await friendManager.rejectFriendRequest(senderId, receiverId);

      return res.status(200).json(createSuccessResponse(null, 'Arkadaşlık isteği reddedildi'));
    } catch (error) {
      logger.error('Arkadaşlık isteği reddetme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        senderId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Arkadaşlık isteği reddedilirken bir hata oluştu';
      let code = 'FRIEND_REJECT_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'REQUEST_NOT_FOUND';
        statusCode = 404;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   DELETE /api/friends/cancel/:userId
 * @desc    Gönderilen arkadaşlık isteğini iptal eder
 * @access  Private
 */
router.delete(
  '/cancel/:userId',
  requireAuth,
  [param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const senderId = req.user!.id;
      const receiverId = req.params['userId'] || '';

      await friendManager.cancelFriendRequest(senderId, receiverId);

      return res.status(200).json(createSuccessResponse(null, 'Arkadaşlık isteği iptal edildi'));
    } catch (error) {
      logger.error('Arkadaşlık isteği iptal etme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        receiverId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Arkadaşlık isteği iptal edilirken bir hata oluştu';
      let code = 'FRIEND_CANCEL_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'REQUEST_NOT_FOUND';
        statusCode = 404;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @route   DELETE /api/friends/:userId
 * @desc    Arkadaşlıktan çıkarır
 * @access  Private
 */
router.delete(
  '/:userId',
  requireAuth,
  [param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const friendId = req.params['userId'] || '';

      await friendManager.removeFriend(userId, friendId);

      return res.status(200).json(createSuccessResponse(null, 'Arkadaşlıktan çıkarıldı'));
    } catch (error) {
      logger.error('Arkadaşlıktan çıkarma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        friendId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Arkadaşlıktan çıkarılırken bir hata oluştu';
      let code = 'FRIEND_REMOVE_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'FRIENDSHIP_NOT_FOUND';
        statusCode = 404;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

export default router;
