/**
 * src/routes/api/notifications.ts
 * Bildirim API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import * as dbNotificationManager from '../../modules/dbNotificationManager';
import { NotificationType } from '../../types/enums';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Kullanıcının bildirimlerini getirir
 * @access  Private
 */
router.get(
  '/',
  requireAuth,
  [
    query('unread')
      .optional()
      .isBoolean()
      .withMessage('Unread parametresi boolean olmalıdır')
      .toBoolean(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('type')
      .optional()
      .isIn(Object.values(NotificationType))
      .withMessage('Geçersiz bildirim türü')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { unread, limit = 50, type } = req.query;
      const userId = req.user!.id;

      // Bildirimleri getir
      let notifications;
      if (unread === 'true') {
        notifications = await dbNotificationManager.getUnreadNotifications(userId);
      } else {
        // Tüm bildirimleri getir (ileride pagination eklenebilir)
        const query: any = { recipient: userId };
        if (type) {
          query.type = type;
        }
        notifications = await dbNotificationManager.Notification.find(query)
          .sort({ createdAt: -1 })
          .limit(Number(limit))
          .populate('sender', 'username profilePicture')
          .exec();
      }

      // Bildirimleri formatla
      const formattedNotifications = notifications.map(dbNotificationManager.formatNotification);

      return res.status(200).json({
        success: true,
        count: formattedNotifications.length,
        data: formattedNotifications
      });
    } catch (error) {
      logger.error('Bildirimleri getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirimler getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   GET /api/notifications/count
 * @desc    Kullanıcının okunmamış bildirim sayısını getirir
 * @access  Private
 */
router.get(
  '/count',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Okunmamış bildirimleri getir
      const notifications = await dbNotificationManager.getUnreadNotifications(userId);

      return res.status(200).json({
        success: true,
        count: notifications.length
      });
    } catch (error) {
      logger.error('Bildirim sayısını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirim sayısı getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   POST /api/notifications
 * @desc    Bildirim oluşturur (sadece admin)
 * @access  Private/Admin
 */
router.post(
  '/',
  requireAuth,
  [
    body('recipientId')
      .isMongoId()
      .withMessage('Geçersiz alıcı ID'),
    body('type')
      .isIn(Object.values(NotificationType))
      .withMessage('Geçersiz bildirim türü'),
    body('content')
      .isString()
      .notEmpty()
      .withMessage('Bildirim içeriği gereklidir')
      .trim(),
    body('target')
      .optional()
      .isObject()
      .withMessage('Hedef bir nesne olmalıdır'),
    body('target.type')
      .if(body('target').exists())
      .isIn(['message', 'directMessage', 'user', 'group', 'channel'])
      .withMessage('Geçersiz hedef türü'),
    body('target.id')
      .if(body('target').exists())
      .isMongoId()
      .withMessage('Geçersiz hedef ID'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high'])
      .withMessage('Geçersiz öncelik'),
    body('expiresIn')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Geçersiz son kullanma süresi')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      // Admin kontrolü
      if (req.user!.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bu işlem için yetkiniz yok'
        });
      }

      const { recipientId, type, content, target, priority, expiresIn, metadata } = req.body;

      // Bildirimi oluştur
      const notification = await dbNotificationManager.createNotification({
        recipientId,
        senderId: req.user!.id,
        type,
        content,
        target,
        priority,
        expiresIn,
        metadata
      });

      return res.status(201).json({
        success: true,
        data: dbNotificationManager.formatNotification(notification)
      });
    } catch (error) {
      logger.error('Bildirim oluşturma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        body: req.body
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirim oluşturulurken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Bildirimi okundu olarak işaretler
 * @access  Private
 */
router.patch(
  '/:id/read',
  requireAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('Geçersiz bildirim ID')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user!.id;

      // Bildirimin kullanıcıya ait olduğunu kontrol et
      const notification = await dbNotificationManager.Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Bildirim bulunamadı'
        });
      }

      // Bildirimi okundu olarak işaretle
      await dbNotificationManager.markNotificationAsRead(notificationId);

      return res.status(200).json({
        success: true,
        message: 'Bildirim okundu olarak işaretlendi'
      });
    } catch (error) {
      logger.error('Bildirimi okundu olarak işaretleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        notificationId: req.params.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirim okundu olarak işaretlenirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Tüm bildirimleri okundu olarak işaretler
 * @access  Private
 */
router.patch(
  '/read-all',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Tüm bildirimleri okundu olarak işaretle
      const result = await dbNotificationManager.markAllNotificationsAsRead(userId);

      return res.status(200).json({
        success: true,
        message: `${result.count} bildirim okundu olarak işaretlendi`
      });
    } catch (error) {
      logger.error('Tüm bildirimleri okundu olarak işaretleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirimler okundu olarak işaretlenirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Bildirimi siler
 * @access  Private
 */
router.delete(
  '/:id',
  requireAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('Geçersiz bildirim ID')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user!.id;

      // Bildirimin kullanıcıya ait olduğunu kontrol et
      const notification = await dbNotificationManager.Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Bildirim bulunamadı'
        });
      }

      // Bildirimi sil
      await dbNotificationManager.deleteNotification(notificationId);

      return res.status(200).json({
        success: true,
        message: 'Bildirim silindi'
      });
    } catch (error) {
      logger.error('Bildirim silme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        notificationId: req.params.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirim silinirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   DELETE /api/notifications
 * @desc    Tüm bildirimleri siler
 * @access  Private
 */
router.delete(
  '/',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Kullanıcının tüm bildirimlerini sil
      const result = await dbNotificationManager.Notification.deleteMany({
        recipient: userId
      });

      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} bildirim silindi`
      });
    } catch (error) {
      logger.error('Tüm bildirimleri silme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Bildirimler silinirken bir hata oluştu'
      });
    }
  })
);

export default router;
