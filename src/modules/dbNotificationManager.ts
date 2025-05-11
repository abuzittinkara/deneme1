/**
 * src/modules/dbNotificationManager.ts
 * Veritabanı bildirim yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Notification, NotificationDocument, NotificationTarget } from '../models/Notification';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { NotificationType } from '../types/enums';
import { toObjectId } from '../types/mongoose';

// Bildirim oluşturma parametreleri
export interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  content: string;
  target?: {
    type: 'message' | 'directMessage' | 'user' | 'group' | 'channel';
    id: string;
  };
  priority?: 'low' | 'normal' | 'high';
  expiresIn?: number; // Saniye cinsinden
  metadata?: Record<string, any>;
}

// Bildirim sonucu
export interface NotificationResult {
  id: string;
  recipient: {
    id: string;
    username: string;
  };
  sender?: {
    id: string;
    username: string;
  };
  type: NotificationType;
  content: string;
  target?: NotificationTarget;
  isRead: boolean;
  createdAt: Date;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Bildirim oluşturur
 * @param params - Bildirim parametreleri
 * @returns Oluşturulan bildirim
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationDocument> {
  try {
    // Alıcıyı kontrol et
    const recipient = await User.findById(params.recipientId);
    if (!recipient) {
      throw new NotFoundError('Alıcı kullanıcı bulunamadı');
    }

    // Göndereni kontrol et (varsa)
    let sender;
    if (params.senderId) {
      sender = await User.findById(params.senderId);
      if (!sender) {
        throw new NotFoundError('Gönderen kullanıcı bulunamadı');
      }
    }

    // Bildirim hedefini oluştur (varsa)
    let target;
    if (params.target) {
      target = {
        type: params.target.type,
        id: toObjectId(params.target.id),
      };
    }

    // Son kullanma tarihini hesapla (varsa)
    let expiresAt;
    if (params.expiresIn) {
      expiresAt = new Date(Date.now() + params.expiresIn * 1000);
    }

    // Bildirimi oluştur
    const notification = await Notification.create({
      recipient: toObjectId(params.recipientId),
      sender: params.senderId ? toObjectId(params.senderId) : undefined,
      type: params.type,
      content: params.content,
      target,
      isRead: false,
      priority: params.priority || 'normal',
      expiresAt,
      metadata: params.metadata,
    });

    logger.info('Bildirim oluşturuldu', {
      notificationId: notification._id,
      recipientId: params.recipientId,
      type: params.type,
    });

    return notification as NotificationDocument;
  } catch (error) {
    logger.error('Bildirim oluşturma hatası', {
      error: (error as Error).message,
      recipientId: params.recipientId,
      type: params.type,
    });
    throw error;
  }
}

/**
 * Kullanıcının okunmamış bildirimlerini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Okunmamış bildirimler
 */
export async function getUnreadNotifications(userId: string): Promise<NotificationDocument[]> {
  try {
    const notifications = await Notification.findUnreadByUser(toObjectId(userId));

    logger.debug('Okunmamış bildirimler getirildi', {
      userId,
      count: notifications.length,
    });

    return notifications;
  } catch (error) {
    logger.error('Okunmamış bildirimleri getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Bildirimi okundu olarak işaretler
 * @param notificationId - Bildirim ID'si
 * @returns İşlem sonucu
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean }> {
  try {
    await Notification.markAsRead(toObjectId(notificationId));

    logger.debug('Bildirim okundu olarak işaretlendi', {
      notificationId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Bildirimi okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      notificationId,
    });
    throw error;
  }
}

/**
 * Kullanıcının tüm bildirimlerini okundu olarak işaretler
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<{ success: boolean; count: number }> {
  try {
    // Önce okunmamış bildirimleri say
    const unreadNotifications = await Notification.findUnreadByUser(toObjectId(userId));
    const count = unreadNotifications.length;

    // Tüm bildirimleri okundu olarak işaretle
    await Notification.markAllAsRead(toObjectId(userId));

    logger.info('Tüm bildirimler okundu olarak işaretlendi', {
      userId,
      count,
    });

    return { success: true, count };
  } catch (error) {
    logger.error('Tüm bildirimleri okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Bildirimi siler
 * @param notificationId - Bildirim ID'si
 * @returns İşlem sonucu
 */
export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  try {
    const result = await Notification.deleteOne({ _id: toObjectId(notificationId) });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Bildirim bulunamadı');
    }

    logger.info('Bildirim silindi', {
      notificationId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Bildirim silme hatası', {
      error: (error as Error).message,
      notificationId,
    });
    throw error;
  }
}

/**
 * Süresi dolmuş bildirimleri temizler
 * @returns Temizlenen bildirim sayısı
 */
export async function cleanupExpiredNotifications(): Promise<{ count: number }> {
  try {
    await Notification.deleteExpired();

    logger.info('Süresi dolmuş bildirimler temizlendi');

    return { count: 0 }; // Gerçek sayı döndürülemiyor çünkü deleteExpired() sayı dönmüyor
  } catch (error) {
    logger.error('Süresi dolmuş bildirimleri temizleme hatası', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Bildirim dokümanını sonuç formatına dönüştürür
 * @param notification - Bildirim dokümanı
 * @returns Bildirim sonucu
 */
export function formatNotification(notification: NotificationDocument): NotificationResult {
  const result: NotificationResult = {
    id: notification._id.toString(),
    recipient: {
      id: notification.recipient.toString(),
      username: (notification.recipient as any)?.username || 'Unknown',
    },
    type: notification.type as NotificationType,
    content: notification.content,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    priority: notification.priority as 'low' | 'normal' | 'high',
  };

  // Gönderen bilgisini ekle (varsa)
  if (notification.sender) {
    result.sender = {
      id: notification.sender.toString(),
      username: (notification.sender as any)?.username || 'Unknown',
    };
  }

  // Hedef bilgisini ekle (varsa)
  if (notification.target) {
    result.target = notification.target;
  }

  return result;
}

// Notification modelini dışa aktar
export { Notification };

export default {
  Notification,
  createNotification,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  cleanupExpiredNotifications,
  formatNotification,
};
