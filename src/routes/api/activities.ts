/**
 * src/routes/api/activities.ts
 * Kullanıcı aktivitesi API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as activityManager from '../../modules/activityManager';
import { ActivityType } from '../../models/UserActivity';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/activities
 * @desc    Kullanıcının aktivitelerini getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('type')
      .optional()
      .isIn(Object.values(ActivityType))
      .withMessage('Geçersiz aktivite türü'),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { limit = 50, type } = req.query;
      const userId = req.user!.id;

      // Aktiviteleri getir
      let activities;
      if (type) {
        activities = await activityManager.getActivitiesByType(type as ActivityType, Number(limit));
      } else {
        activities = await activityManager.getUserActivities(userId, Number(limit));
      }

      // Aktiviteleri formatla
      const formattedActivities = activities.map(activityManager.formatActivity);

      return res.status(200).json({
        success: true,
        count: formattedActivities.length,
        data: formattedActivities,
      });
    } catch (error) {
      logger.error('Aktiviteleri getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        query: req.query,
      });
      return res.status(500).json({
        success: false,
        message: 'Aktiviteler getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/activities/user/:userId
 * @desc    Belirli bir kullanıcının aktivitelerini getirir (sadece admin)
 * @access  Private/Admin
 */
router.get(
  '/user/:userId',
  requireAuth,
  [
    param('userId').isMongoId().withMessage('Geçersiz kullanıcı ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      // Admin kontrolü
      if (req.user!.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bu işlem için yetkiniz yok',
        });
      }

      const { userId } = req.params;
      const { limit = 50 } = req.query;

      // Aktiviteleri getir
      const activities = await activityManager.getUserActivities(userId, Number(limit));

      // Aktiviteleri formatla
      const formattedActivities = activities.map(activityManager.formatActivity);

      return res.status(200).json({
        success: true,
        count: formattedActivities.length,
        data: formattedActivities,
      });
    } catch (error) {
      logger.error('Kullanıcı aktivitelerini getirme hatası', {
        error: (error as Error).message,
        adminId: req.user!.id,
        userId: req.params.userId,
      });
      return res.status(500).json({
        success: false,
        message: 'Kullanıcı aktiviteleri getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/activities/type/:type
 * @desc    Belirli bir türdeki aktiviteleri getirir (sadece admin)
 * @access  Private/Admin
 */
router.get(
  '/type/:type',
  requireAuth,
  [
    param('type').isIn(Object.values(ActivityType)).withMessage('Geçersiz aktivite türü'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      // Admin kontrolü
      if (req.user!.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bu işlem için yetkiniz yok',
        });
      }

      const { type } = req.params;
      const { limit = 50 } = req.query;

      // Aktiviteleri getir
      const activities = await activityManager.getActivitiesByType(
        type as ActivityType,
        Number(limit)
      );

      // Aktiviteleri formatla
      const formattedActivities = activities.map(activityManager.formatActivity);

      return res.status(200).json({
        success: true,
        count: formattedActivities.length,
        data: formattedActivities,
      });
    } catch (error) {
      logger.error('Aktivite türüne göre getirme hatası', {
        error: (error as Error).message,
        adminId: req.user!.id,
        type: req.params.type,
      });
      return res.status(500).json({
        success: false,
        message: 'Aktiviteler getirilirken bir hata oluştu',
      });
    }
  })
);

/**
 * @route   GET /api/activities/target/:targetType/:targetId
 * @desc    Belirli bir hedefle ilgili aktiviteleri getirir
 * @access  Private
 */
router.get(
  '/target/:targetType/:targetId',
  requireAuth,
  [
    param('targetType')
      .isIn(['message', 'directMessage', 'user', 'group', 'channel', 'role'])
      .withMessage('Geçersiz hedef türü'),
    param('targetId').isMongoId().withMessage('Geçersiz hedef ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { targetType, targetId } = req.params;
      const { limit = 50 } = req.query;

      // Hedef türüne göre yetki kontrolü
      if (targetType === 'user' && targetId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bu kullanıcının aktivitelerini görüntüleme yetkiniz yok',
        });
      }

      // Aktiviteleri getir
      const activities = await activityManager.getActivitiesByTarget(
        targetType,
        targetId,
        Number(limit)
      );

      // Aktiviteleri formatla
      const formattedActivities = activities.map(activityManager.formatActivity);

      return res.status(200).json({
        success: true,
        count: formattedActivities.length,
        data: formattedActivities,
      });
    } catch (error) {
      logger.error('Hedefe göre aktiviteleri getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        targetType: req.params.targetType,
        targetId: req.params.targetId,
      });
      return res.status(500).json({
        success: false,
        message: 'Aktiviteler getirilirken bir hata oluştu',
      });
    }
  })
);

export default router;
