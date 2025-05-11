/**
 * src/routes/api/invitations.ts
 * Davetiye API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as invitationManager from '../../modules/invitationManager';
import { InvitationType } from '../../models/Invitation';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/invitations
 * @desc    Kullanıcının oluşturduğu davetiyeleri getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Davetiyeleri getir
      const invitations = await invitationManager.getInvitationsByCreator(userId);

      // Davetiyeleri formatla
      const formattedInvitations = invitations.map(invitationManager.formatInvitation);

      return res.status(200).json({
        success: true,
        count: formattedInvitations.length,
        data: formattedInvitations,
      });
    } catch (error) {
      logger.error('Davetiyeleri getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res.status(500).json({
        success: false,
        message: 'Davetiyeler getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/invitations/received
 * @desc    Kullanıcıya gönderilen davetiyeleri getirir
 * @access  Private
 */
router.get(
  '/received',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Davetiyeleri getir
      const invitations = await invitationManager.getInvitationsByRecipient(userId);

      // Davetiyeleri formatla
      const formattedInvitations = invitations.map(invitationManager.formatInvitation);

      return res.status(200).json({
        success: true,
        count: formattedInvitations.length,
        data: formattedInvitations,
      });
    } catch (error) {
      logger.error('Alınan davetiyeleri getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res.status(500).json({
        success: false,
        message: 'Davetiyeler getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/invitations
 * @desc    Davetiye oluşturur
 * @access  Private
 */
router.post(
  '/',
  requireAuth,
  [
    body('type').isIn(Object.values(InvitationType)).withMessage('Geçersiz davetiye türü'),
    body('targetId').isMongoId().withMessage('Geçersiz hedef ID'),
    body('recipientId').optional().isMongoId().withMessage('Geçersiz alıcı ID'),
    body('maxUses')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Maksimum kullanım sayısı 1-100 arasında olmalıdır'),
    body('expiresIn')
      .optional()
      .isInt({ min: 60, max: 2592000 }) // 1 dakika - 30 gün
      .withMessage('Geçerlilik süresi 1 dakika ile 30 gün arasında olmalıdır'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { type, targetId, recipientId, maxUses, expiresIn } = req.body;
      const creatorId = req.user!.id;

      // Davetiye oluştur
      const invitation = await invitationManager.createInvitation({
        type,
        targetId,
        creatorId,
        recipientId,
        maxUses,
        expiresIn,
      });

      return res.status(201).json({
        success: true,
        data: invitationManager.formatInvitation(invitation),
      });
    } catch (error) {
      logger.error('Davetiye oluşturma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        body: req.body,
      });

      // Hata mesajını belirle
      let message = 'Davetiye oluşturulurken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      } else if ((error as any).name === 'NotFoundError') {
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
 * @route   GET /api/invitations/:code
 * @desc    Davetiye bilgilerini getirir
 * @access  Public
 */
router.get(
  '/:code',
  [param('code').isString().isLength({ min: 6, max: 10 }).withMessage('Geçersiz davetiye kodu')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const code = req.params['code'] || '';

      // Davetiyeyi getir
      const invitation = await invitationManager.getInvitationByCode(code);

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Davetiye bulunamadı',
        });
      }

      // Davetiyenin geçerli olup olmadığını kontrol et
      const isValid = invitation.isValid();

      return res.status(200).json({
        success: true,
        data: {
          ...invitationManager.formatInvitation(invitation),
          isValid,
        },
      });
    } catch (error) {
      logger.error('Davetiye bilgilerini getirme hatası', {
        error: (error as Error).message,
        code: req.params['code'],
      });
      return res.status(500).json({
        success: false,
        message: 'Davetiye bilgileri getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   POST /api/invitations/:code/accept
 * @desc    Davetiyeyi kabul eder
 * @access  Private
 */
router.post(
  '/:code/accept',
  requireAuth,
  [param('code').isString().isLength({ min: 6, max: 10 }).withMessage('Geçersiz davetiye kodu')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const code = req.params['code'] || '';
      const userId = req.user!.id;

      // Davetiyeyi kabul et
      const result = await invitationManager.acceptInvitation({
        code,
        userId,
      });

      return res.status(200).json({
        success: true,
        message: 'Davetiye kabul edildi',
        data: invitationManager.formatInvitation(result.invitation),
      });
    } catch (error) {
      logger.error('Davetiye kabul etme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        code: req.params['code'],
      });

      // Hata mesajını belirle
      let message = 'Davetiye kabul edilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      } else if ((error as any).name === 'NotFoundError') {
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
 * @route   DELETE /api/invitations/:id
 * @desc    Davetiyeyi iptal eder
 * @access  Private
 */
router.delete(
  '/:id',
  requireAuth,
  [param('id').isMongoId().withMessage('Geçersiz davetiye ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] || '';
      const userId = req.user!.id;

      // Davetiyeyi iptal et
      await invitationManager.revokeInvitation(id, userId);

      return res.status(200).json({
        success: true,
        message: 'Davetiye iptal edildi',
      });
    } catch (error) {
      logger.error('Davetiye iptal etme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        invitationId: req.params['id'],
      });

      // Hata mesajını belirle
      let message = 'Davetiye iptal edilirken bir hata oluştu';
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

export default router;
