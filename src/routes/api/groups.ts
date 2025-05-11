/**
 * src/routes/api/groups.ts
 * Grup API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as groupManager from '../../modules/group/groupManager';
import * as settingsManager from '../../modules/group/settingsManager';
import * as memberManager from '../../modules/group/memberManager';
import * as statsManager from '../../modules/group/statsManager';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/groups
 * @desc    Kullanıcının gruplarını getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const groups = await groupManager.getUserGroups(userId);

      return res.status(200).json({
        success: true,
        data: groups,
      });
    } catch (error) {
      logger.error('Grupları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });
      return res.status(500).json({
        success: false,
        message: 'Gruplar getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/groups/:groupId
 * @desc    Grup detaylarını getirir
 * @access  Private
 */
router.get(
  '/:groupId',
  requireAuth,
  [param('groupId').isString().withMessage('Geçersiz grup ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const userId = req.user!.id;

      const group = await groupManager.getGroupDetails(groupId, userId);

      return res.status(200).json({
        success: true,
        data: group,
      });
    } catch (error) {
      logger.error('Grup detaylarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
      });

      // Hata mesajını belirle
      let message = 'Grup detayları getirilirken bir hata oluştu';
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
 * @route   POST /api/groups
 * @desc    Yeni grup oluşturur
 * @access  Private
 */
router.post(
  '/',
  requireAuth,
  [
    body('name').isString().notEmpty().withMessage('Grup adı gereklidir').trim(),
    body('description').isString().withMessage('Geçersiz açıklama formatı').trim(),
    body('type').optional().isIn(['public', 'private', 'secret']).withMessage('Geçersiz grup türü'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { name, description, type = 'public' } = req.body;
      const userId = req.user!.id;

      const group = await groupManager.createGroup({
        name,
        description,
        type,
        ownerId: userId,
      });

      return res.status(201).json({
        success: true,
        data: group,
      });
    } catch (error) {
      logger.error('Grup oluşturma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        body: req.body,
      });
      return res.status(500).json({
        success: false,
        message: 'Grup oluşturulurken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/groups/:groupId/settings
 * @desc    Grup ayarlarını getirir
 * @access  Private
 */
router.get(
  '/:groupId/settings',
  requireAuth,
  [param('groupId').isString().withMessage('Geçersiz grup ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';

      const settings = await settingsManager.getGroupSettings(groupId);

      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('Grup ayarlarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
      });

      // Hata mesajını belirle
      let message = 'Grup ayarları getirilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
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
 * @route   PATCH /api/groups/:groupId/settings
 * @desc    Grup ayarlarını günceller
 * @access  Private
 */
router.patch(
  '/:groupId/settings',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    body('name').optional().isString().notEmpty().withMessage('Grup adı boş olamaz').trim(),
    body('description').optional().isString().withMessage('Geçersiz açıklama formatı').trim(),
    body('type').optional().isIn(['public', 'private', 'secret']).withMessage('Geçersiz grup türü'),
    body('rules').optional().isString().withMessage('Geçersiz kurallar formatı').trim(),
    body('defaultRole').optional().isMongoId().withMessage('Geçersiz rol ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const userId = req.user!.id;
      const settings = req.body;

      const updatedSettings = await settingsManager.updateGroupSettings({
        groupId,
        userId,
        settings,
      });

      return res.status(200).json({
        success: true,
        data: updatedSettings,
      });
    } catch (error) {
      logger.error('Grup ayarlarını güncelleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        body: req.body,
      });

      // Hata mesajını belirle
      let message = 'Grup ayarları güncellenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   GET /api/groups/:groupId/members
 * @desc    Grup üyelerini getirir
 * @access  Private
 */
router.get(
  '/:groupId/members',
  requireAuth,
  [param('groupId').isString().withMessage('Geçersiz grup ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';

      const members = await memberManager.getGroupMembers(groupId);

      return res.status(200).json({
        success: true,
        data: members,
      });
    } catch (error) {
      logger.error('Grup üyelerini getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
      });

      // Hata mesajını belirle
      let message = 'Grup üyeleri getirilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
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
 * @route   POST /api/groups/:groupId/members
 * @desc    Gruba üye ekler
 * @access  Private
 */
router.post(
  '/:groupId/members',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    body('username').isString().notEmpty().withMessage('Kullanıcı adı gereklidir').trim(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const { username } = req.body;
      const userId = req.user!.id;

      const member = await memberManager.addGroupMember(groupId, userId, username);

      return res.status(201).json({
        success: true,
        data: member,
      });
    } catch (error) {
      logger.error('Grup üyesi ekleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        body: req.body,
      });

      // Hata mesajını belirle
      let message = 'Grup üyesi eklenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   DELETE /api/groups/:groupId/members/:memberId
 * @desc    Grup üyesini çıkarır
 * @access  Private
 */
router.delete(
  '/:groupId/members/:memberId',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    param('memberId').isMongoId().withMessage('Geçersiz üye ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const memberId = req.params['memberId'] || '';
      const userId = req.user!.id;

      await memberManager.removeGroupMember(groupId, userId, memberId);

      return res.status(200).json({
        success: true,
        message: 'Üye gruptan çıkarıldı',
      });
    } catch (error) {
      logger.error('Grup üyesi çıkarma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        memberId: req.params['memberId'],
      });

      // Hata mesajını belirle
      let message = 'Grup üyesi çıkarılırken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   POST /api/groups/:groupId/members/:memberId/roles/:roleId
 * @desc    Üyeye rol atar
 * @access  Private
 */
router.post(
  '/:groupId/members/:memberId/roles/:roleId',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    param('memberId').isMongoId().withMessage('Geçersiz üye ID'),
    param('roleId').isMongoId().withMessage('Geçersiz rol ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const memberId = req.params['memberId'] || '';
      const roleId = req.params['roleId'] || '';
      const userId = req.user!.id;

      await memberManager.assignRole({
        groupId,
        userId,
        memberId,
        roleId,
      });

      return res.status(200).json({
        success: true,
        message: 'Rol atandı',
      });
    } catch (error) {
      logger.error('Rol atama hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        memberId: req.params['memberId'],
        roleId: req.params['roleId'],
      });

      // Hata mesajını belirle
      let message = 'Rol atanırken bir hata oluştu';
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
 * @route   DELETE /api/groups/:groupId/members/:memberId/roles/:roleId
 * @desc    Üyeden rol kaldırır
 * @access  Private
 */
router.delete(
  '/:groupId/members/:memberId/roles/:roleId',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    param('memberId').isMongoId().withMessage('Geçersiz üye ID'),
    param('roleId').isMongoId().withMessage('Geçersiz rol ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const memberId = req.params['memberId'] || '';
      const roleId = req.params['roleId'] || '';
      const userId = req.user!.id;

      await memberManager.removeRole(groupId, userId, memberId, roleId);

      return res.status(200).json({
        success: true,
        message: 'Rol kaldırıldı',
      });
    } catch (error) {
      logger.error('Rol kaldırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        memberId: req.params['memberId'],
        roleId: req.params['roleId'],
      });

      // Hata mesajını belirle
      let message = 'Rol kaldırılırken bir hata oluştu';
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
 * @route   GET /api/groups/:groupId/stats
 * @desc    Grup istatistiklerini getirir
 * @access  Private
 */
router.get(
  '/:groupId/stats',
  requireAuth,
  [param('groupId').isString().withMessage('Geçersiz grup ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';

      const stats = await statsManager.getGroupStats(groupId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Grup istatistiklerini getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
      });

      // Hata mesajını belirle
      let message = 'Grup istatistikleri getirilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
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
 * @route   POST /api/groups/:groupId/ban/:memberId
 * @desc    Kullanıcıyı gruptan yasaklar
 * @access  Private
 */
router.post(
  '/:groupId/ban/:memberId',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    param('memberId').isMongoId().withMessage('Geçersiz üye ID'),
    body('reason').optional().isString().withMessage('Geçersiz neden formatı').trim(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const memberId = req.params['memberId'] || '';
      const { reason } = req.body;
      const userId = req.user!.id;

      await memberManager.banGroupMember(groupId, userId, memberId, reason);

      return res.status(200).json({
        success: true,
        message: 'Kullanıcı gruptan yasaklandı',
      });
    } catch (error) {
      logger.error('Kullanıcı yasaklama hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        memberId: req.params['memberId'],
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı yasaklanırken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

/**
 * @route   DELETE /api/groups/:groupId/ban/:userId
 * @desc    Kullanıcının grup yasağını kaldırır
 * @access  Private
 */
router.delete(
  '/:groupId/ban/:userId',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const bannedUserId = req.params['userId'] || '';
      const userId = req.user!.id;

      await memberManager.unbanGroupMember(groupId, userId, bannedUserId);

      return res.status(200).json({
        success: true,
        message: 'Kullanıcının yasağı kaldırıldı',
      });
    } catch (error) {
      logger.error('Kullanıcı yasağını kaldırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        bannedUserId: req.params['userId'],
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı yasağı kaldırılırken bir hata oluştu';
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
 * @route   POST /api/groups/:groupId/transfer-ownership
 * @desc    Grup sahipliğini transfer eder
 * @access  Private
 */
router.post(
  '/:groupId/transfer-ownership',
  requireAuth,
  [
    param('groupId').isString().withMessage('Geçersiz grup ID'),
    body('newOwnerId').isMongoId().withMessage('Geçersiz yeni sahip ID'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const groupId = req.params['groupId'] || '';
      const newOwnerId = req.body.newOwnerId || '';
      const userId = req.user!.id;

      await settingsManager.transferGroupOwnership(groupId, userId, newOwnerId);

      return res.status(200).json({
        success: true,
        message: 'Grup sahipliği transfer edildi',
      });
    } catch (error) {
      logger.error('Grup sahipliği transfer hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        groupId: req.params['groupId'],
        newOwnerId: req.body.newOwnerId,
      });

      // Hata mesajını belirle
      let message = 'Grup sahipliği transfer edilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  })
);

export default router;
