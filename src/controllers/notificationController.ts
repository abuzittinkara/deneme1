/**
 * src/controllers/notificationController.ts
 * Bildirim controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/controllerUtils';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import mongoose from 'mongoose';

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Kullanıcının bildirimlerini getirir
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına bildirim sayısı
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Atlanacak bildirim sayısı
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Okunma durumuna göre filtrele
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [message, friend_request, friend_accept, group_invite, group_join, group_leave, mention, reply, reaction, system, admin]
 *         description: Bildirim türüne göre filtrele
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sıralama alanı
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sıralama yönü
 *     responses:
 *       200:
 *         description: Bildirimler başarıyla getirildi
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  
  // Sorgu parametrelerini al
  const limit = parseInt(req.query.limit as string || '20');
  const skip = parseInt(req.query.skip as string || '0');
  const isRead = req.query.isRead !== undefined 
    ? req.query.isRead === 'true' 
    : undefined;
  const type = req.query.type as string;
  const sortBy = req.query.sortBy as string || 'createdAt';
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
  
  // Bildirimleri getir
  const result = await notificationService.getUserNotifications(userId, {
    limit,
    skip,
    isRead,
    type: type as any,
    sortBy,
    sortOrder
  });
  
  return sendSuccess(res, result);
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Okunmamış bildirim sayısını getirir
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Okunmamış bildirim sayısı başarıyla getirildi
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
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getUnreadCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  
  // Okunmamış bildirimleri getir
  const result = await notificationService.getUserNotifications(userId, {
    limit: 0,
    isRead: false
  });
  
  return sendSuccess(res, { unreadCount: result.unreadCount });
});

/**
 * @swagger
 * /api/notifications/{id}/mark-as-read:
 *   patch:
 *     summary: Bildirimi okundu olarak işaretler
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Bildirim ID
 *     responses:
 *       200:
 *         description: Bildirim başarıyla okundu olarak işaretlendi
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
 *                     message:
 *                       type: string
 *                       example: Bildirim okundu olarak işaretlendi
 *       400:
 *         description: Geçersiz bildirim ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bildirim bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  const notificationId = req.params.id;
  
  // ID'yi doğrula
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ValidationError('Geçersiz bildirim ID');
  }
  
  // Bildirimi okundu olarak işaretle
  const success = await notificationService.markAsRead(notificationId, userId);
  
  if (!success) {
    throw new NotFoundError('Bildirim bulunamadı veya zaten okundu olarak işaretlenmiş');
  }
  
  return sendSuccess(res, { message: 'Bildirim okundu olarak işaretlendi' });
});

/**
 * @swagger
 * /api/notifications/mark-all-as-read:
 *   patch:
 *     summary: Tüm bildirimleri okundu olarak işaretler
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tüm bildirimler başarıyla okundu olarak işaretlendi
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
 *                     message:
 *                       type: string
 *                       example: Tüm bildirimler okundu olarak işaretlendi
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  
  // Tüm bildirimleri okundu olarak işaretle
  await notificationService.markAllAsRead(userId);
  
  return sendSuccess(res, { message: 'Tüm bildirimler okundu olarak işaretlendi' });
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Bildirimi siler
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Bildirim ID
 *     responses:
 *       200:
 *         description: Bildirim başarıyla silindi
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
 *                     message:
 *                       type: string
 *                       example: Bildirim silindi
 *       400:
 *         description: Geçersiz bildirim ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bildirim bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const deleteNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  const notificationId = req.params.id;
  
  // ID'yi doğrula
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ValidationError('Geçersiz bildirim ID');
  }
  
  // Bildirimi sil
  const success = await notificationService.deleteNotification(notificationId, userId);
  
  if (!success) {
    throw new NotFoundError('Bildirim bulunamadı');
  }
  
  return sendSuccess(res, { message: 'Bildirim silindi' });
});

/**
 * @swagger
 * /api/notifications:
 *   delete:
 *     summary: Tüm bildirimleri siler
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tüm bildirimler başarıyla silindi
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
 *                     message:
 *                       type: string
 *                       example: Tüm bildirimler silindi
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user._id;
  
  // Tüm bildirimleri sil
  await notificationService.deleteAllNotifications(userId);
  
  return sendSuccess(res, { message: 'Tüm bildirimler silindi' });
});

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
};
