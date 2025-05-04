/**
 * src/routes/notificationRoutes.ts
 * Bildirim rotaları
 */
import express from 'express';
import notificationController from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(authMiddleware);

// Bildirim rotaları
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/mark-as-read', notificationController.markAsRead);
router.patch('/mark-all-as-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/', notificationController.deleteAllNotifications);

export default router;
