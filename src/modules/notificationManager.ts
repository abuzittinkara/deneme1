/**
 * src/modules/notificationManager.ts
 * Bildirim yönetimi işlemleri
 */
import webpush, { PushSubscription } from 'web-push';
import { User, UserDocument } from '../models/User';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// VAPID anahtarları arayüzü
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

// Bildirim içeriği arayüzü
export interface NotificationPayload {
  title?: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

// Bildirim sonucu arayüzü
export interface NotificationResult {
  success: boolean;
  message: string;
}

// Toplu bildirim sonucu arayüzü
export interface BulkNotificationResult {
  success: number;
  failed: number;
  errors: Array<{ userId: string; message: string }>;
}

// VAPID anahtarlarını ayarla (gerçek uygulamada .env dosyasından alınmalı)
export const vapidKeys: VapidKeys = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSbtM',
};

webpush.setVapidDetails('mailto:info@fisqos.com.tr', vapidKeys.publicKey, vapidKeys.privateKey);

/**
 * Kullanıcının push aboneliğini kaydeder
 * @param userId - Kullanıcı ID'si
 * @param subscription - Push abonelik nesnesi
 * @returns İşlem sonucu
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<NotificationResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    user.pushSubscription = subscription;
    await user.save();

    logger.info('Bildirim aboneliği kaydedildi', { userId });

    return { success: true, message: 'Bildirim aboneliği kaydedildi' };
  } catch (error) {
    logger.error('Push aboneliği kaydetme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Kullanıcıya push bildirimi gönderir
 * @param userId - Kullanıcı ID'si
 * @param notification - Bildirim içeriği
 * @returns İşlem sonucu
 */
export async function sendPushNotification(
  userId: string,
  notification: NotificationPayload
): Promise<NotificationResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user || !user.pushSubscription) {
      logger.warn('Kullanıcı bildirim aboneliği bulunamadı', { userId });
      return { success: false, message: 'Kullanıcı bildirim aboneliği bulunamadı' };
    }

    // Kullanıcı bildirim tercihini kontrol et
    if (user.preferences && user.preferences.notifications === false) {
      logger.debug('Kullanıcı bildirimleri devre dışı bırakmış', { userId });
      return { success: false, message: 'Kullanıcı bildirimleri devre dışı bırakmış' };
    }

    const payload = JSON.stringify({
      title: notification.title || 'Fisqos',
      body: notification.body,
      icon: notification.icon || '/images/logo.png',
      badge: notification.badge || '/images/badge.png',
      data: notification.data || {},
    });

    await webpush.sendNotification(user.pushSubscription as PushSubscription, payload);

    logger.info('Bildirim gönderildi', {
      userId,
      title: notification.title,
      type: notification.data?.type,
    });

    return { success: true, message: 'Bildirim gönderildi' };
  } catch (error) {
    logger.error('Push bildirimi gönderme hatası', {
      error: (error as Error).message,
      userId,
      statusCode: (error as any).statusCode,
    });

    // Abonelik süresi dolmuşsa veya geçersizse, aboneliği kaldır
    if ((error as any).statusCode === 404 || (error as any).statusCode === 410) {
      try {
        await UserHelper.getModel().updateOne({ _id: userId }, { $unset: { pushSubscription: 1 } });
        logger.info('Geçersiz abonelik kaldırıldı', { userId });
      } catch (err) {
        logger.error('Abonelik kaldırma hatası', { error: (err as Error).message, userId });
      }
    }

    throw error;
  }
}

/**
 * Birden çok kullanıcıya bildirim gönderir
 * @param userIds - Kullanıcı ID'leri
 * @param notification - Bildirim içeriği
 * @returns İşlem sonucu
 */
export async function sendBulkNotifications(
  userIds: string[],
  notification: NotificationPayload
): Promise<BulkNotificationResult> {
  const results: BulkNotificationResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const userId of userIds) {
    try {
      const result = await sendPushNotification(userId, notification);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId, message: result.message });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ userId, message: (error as Error).message });
    }
  }

  logger.info('Toplu bildirim gönderildi', {
    userCount: userIds.length,
    successCount: results.success,
    failedCount: results.failed,
  });

  return results;
}

/**
 * Yeni mesaj bildirimi gönderir
 * @param receiverId - Alıcı kullanıcı ID'si
 * @param senderName - Gönderen kullanıcı adı
 * @param messagePreview - Mesaj önizlemesi
 * @param channelName - Kanal adı (opsiyonel, DM için null)
 * @returns İşlem sonucu
 */
export async function sendNewMessageNotification(
  receiverId: string,
  senderName: string,
  messagePreview: string,
  channelName: string | null = null
): Promise<NotificationResult> {
  const title = channelName
    ? `${channelName} kanalında yeni mesaj`
    : `${senderName} size mesaj gönderdi`;

  const body =
    messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview;

  return sendPushNotification(receiverId, {
    title,
    body,
    data: {
      type: 'new_message',
      sender: senderName,
      channel: channelName,
    },
  });
}

/**
 * Arkadaşlık isteği bildirimi gönderir
 * @param receiverId - Alıcı kullanıcı ID'si
 * @param senderName - Gönderen kullanıcı adı
 * @returns İşlem sonucu
 */
export async function sendFriendRequestNotification(
  receiverId: string,
  senderName: string
): Promise<NotificationResult> {
  return sendPushNotification(receiverId, {
    title: 'Yeni Arkadaşlık İsteği',
    body: `${senderName} size arkadaşlık isteği gönderdi`,
    data: {
      type: 'friend_request',
      sender: senderName,
    },
  });
}

/**
 * Grup daveti bildirimi gönderir
 * @param receiverId - Alıcı kullanıcı ID'si
 * @param senderName - Davet eden kullanıcı adı
 * @param groupName - Grup adı
 * @returns İşlem sonucu
 */
export async function sendGroupInviteNotification(
  receiverId: string,
  senderName: string,
  groupName: string
): Promise<NotificationResult> {
  return sendPushNotification(receiverId, {
    title: 'Grup Daveti',
    body: `${senderName} sizi "${groupName}" grubuna davet etti`,
    data: {
      type: 'group_invite',
      sender: senderName,
      group: groupName,
    },
  });
}

/**
 * Bildirim aboneliğini siler
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function removePushSubscription(userId: string): Promise<NotificationResult> {
  try {
    const result = await UserHelper.getModel().updateOne(
      { _id: userId },
      { $unset: { pushSubscription: 1 } }
    );

    if (result.modifiedCount === 0) {
      return { success: false, message: 'Abonelik bulunamadı veya zaten silinmiş' };
    }

    logger.info('Bildirim aboneliği silindi', { userId });

    return { success: true, message: 'Bildirim aboneliği silindi' };
  } catch (error) {
    logger.error('Bildirim aboneliği silme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

export default {
  vapidKeys,
  savePushSubscription,
  sendPushNotification,
  sendBulkNotifications,
  sendNewMessageNotification,
  sendFriendRequestNotification,
  sendGroupInviteNotification,
  removePushSubscription,
};
