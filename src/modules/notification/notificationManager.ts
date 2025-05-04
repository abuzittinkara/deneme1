/**
 * src/modules/notification/notificationManager.ts
 * Bildirim işlemleri yöneticisi
 */
import mongoose from 'mongoose';
import { Notification } from '../../models/Notification';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { NotificationTypes } from '../../types/common';

/**
 * Kullanıcının bildirimlerini getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Sayfa başına kayıt sayısı
 * @param skip - Atlanacak kayıt sayısı
 * @returns Bildirimler listesi
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50,
  skip: number = 0
): Promise<any[]> {
  try {
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username displayName avatar')
      .populate('group', 'name icon')
      .populate('channel', 'name')
      .lean();

    logger.debug('Kullanıcı bildirimleri getirildi', {
      userId,
      count: notifications.length
    });

    return notifications;
  } catch (error) {
    logger.error('Kullanıcı bildirimleri getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Okunmamış bildirim sayısını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Okunmamış bildirim sayısı
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const count = await Notification.countDocuments({
      recipient: userId,
      read: false
    });

    logger.debug('Okunmamış bildirim sayısı getirildi', {
      userId,
      count
    });

    return count;
  } catch (error) {
    logger.error('Okunmamış bildirim sayısı getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Bildirimi okundu olarak işaretler
 * @param notificationId - Bildirim ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      logger.warn('Bildirim bulunamadı veya kullanıcıya ait değil', {
        notificationId,
        userId
      });
      return false;
    }

    logger.debug('Bildirim okundu olarak işaretlendi', {
      notificationId,
      userId
    });

    return true;
  } catch (error) {
    logger.error('Bildirim okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      notificationId,
      userId
    });
    throw error;
  }
}

/**
 * Tüm bildirimleri okundu olarak işaretler
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    const result = await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true }
    );

    logger.debug('Tüm bildirimler okundu olarak işaretlendi', {
      userId,
      count: result.modifiedCount
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Tüm bildirimleri okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteği bildirimi oluşturur
 * @param recipientId - Alıcı kullanıcı ID'si
 * @param senderId - Gönderen kullanıcı ID'si
 * @returns Oluşturulan bildirim
 */
export async function createFriendRequestNotification(
  recipientId: string,
  senderId: string
): Promise<any> {
  try {
    const notification = new Notification({
      type: NotificationTypes.FRIEND_REQUEST,
      recipient: recipientId,
      sender: senderId,
      read: false
    });

    await notification.save();

    logger.debug('Arkadaşlık isteği bildirimi oluşturuldu', {
      recipientId,
      senderId,
      notificationId: notification._id
    });

    return notification;
  } catch (error) {
    logger.error('Arkadaşlık isteği bildirimi oluşturma hatası', {
      error: (error as Error).message,
      recipientId,
      senderId
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteği kabul bildirimi oluşturur
 * @param recipientId - Alıcı kullanıcı ID'si
 * @param senderId - Gönderen kullanıcı ID'si
 * @returns Oluşturulan bildirim
 */
export async function createFriendAcceptNotification(
  recipientId: string,
  senderId: string
): Promise<any> {
  try {
    const notification = new Notification({
      type: NotificationTypes.FRIEND_ACCEPT,
      recipient: recipientId,
      sender: senderId,
      read: false
    });

    await notification.save();

    logger.debug('Arkadaşlık isteği kabul bildirimi oluşturuldu', {
      recipientId,
      senderId,
      notificationId: notification._id
    });

    return notification;
  } catch (error) {
    logger.error('Arkadaşlık isteği kabul bildirimi oluşturma hatası', {
      error: (error as Error).message,
      recipientId,
      senderId
    });
    throw error;
  }
}

/**
 * Bahsetme bildirimi oluşturur
 * @param recipientId - Alıcı kullanıcı ID'si
 * @param senderId - Gönderen kullanıcı ID'si
 * @param channelId - Kanal ID'si
 * @param messageId - Mesaj ID'si
 * @returns Oluşturulan bildirim
 */
export async function createMentionNotification(
  recipientId: string,
  senderId: string,
  channelId: string,
  messageId: string
): Promise<any> {
  try {
    // Kendine bildirim göndermeyi engelle
    if (recipientId === senderId) {
      return null;
    }

    const notification = new Notification({
      type: NotificationTypes.MENTION,
      recipient: recipientId,
      sender: senderId,
      channel: channelId,
      message: messageId,
      read: false
    });

    await notification.save();

    logger.debug('Bahsetme bildirimi oluşturuldu', {
      recipientId,
      senderId,
      channelId,
      messageId,
      notificationId: notification._id
    });

    return notification;
  } catch (error) {
    logger.error('Bahsetme bildirimi oluşturma hatası', {
      error: (error as Error).message,
      recipientId,
      senderId,
      channelId,
      messageId
    });
    throw error;
  }
}

/**
 * Grup daveti bildirimi oluşturur
 * @param recipientId - Alıcı kullanıcı ID'si
 * @param senderId - Gönderen kullanıcı ID'si
 * @param groupId - Grup ID'si
 * @returns Oluşturulan bildirim
 */
export async function createGroupInviteNotification(
  recipientId: string,
  senderId: string,
  groupId: string
): Promise<any> {
  try {
    const notification = new Notification({
      type: NotificationTypes.GROUP_INVITE,
      recipient: recipientId,
      sender: senderId,
      group: groupId,
      read: false
    });

    await notification.save();

    logger.debug('Grup daveti bildirimi oluşturuldu', {
      recipientId,
      senderId,
      groupId,
      notificationId: notification._id
    });

    return notification;
  } catch (error) {
    logger.error('Grup daveti bildirimi oluşturma hatası', {
      error: (error as Error).message,
      recipientId,
      senderId,
      groupId
    });
    throw error;
  }
}

export default {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createFriendRequestNotification,
  createFriendAcceptNotification,
  createMentionNotification,
  createGroupInviteNotification
};
