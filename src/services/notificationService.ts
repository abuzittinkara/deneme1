/**
 * src/services/notificationService.ts
 * Bildirim servisi
 */
import { logger } from '../utils/logger';
import { Notification, NotificationDocument } from '../models/Notification';
import { User } from '../models/User';
import { NotificationType } from '../types/enums';
import mongoose from 'mongoose';
import { io } from '../socket/socketServer';
import { t } from '../utils/i18n';

/**
 * Bildirim servisi
 */
class NotificationService {
  /**
   * Bildirim oluşturur
   * @param data Bildirim verileri
   * @returns Oluşturulan bildirim
   */
  async createNotification(data: {
    recipient: string | mongoose.Types.ObjectId;
    sender?: string | mongoose.Types.ObjectId;
    type: NotificationType;
    content: string;
    target?: {
      type: 'message' | 'directMessage' | 'user' | 'group' | 'channel';
      id: string | mongoose.Types.ObjectId;
    };
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<NotificationDocument | null> {
    try {
      // Alıcıyı kontrol et
      const recipientId =
        typeof data.recipient === 'string'
          ? new mongoose.Types.ObjectId(data.recipient)
          : data.recipient;

      const recipient = await User.findById(recipientId);

      if (!recipient) {
        logger.warn('Bildirim alıcısı bulunamadı', { recipientId });
        return null;
      }

      // Göndereni kontrol et (varsa)
      let senderId = undefined;
      if (data.sender) {
        senderId =
          typeof data.sender === 'string' ? new mongoose.Types.ObjectId(data.sender) : data.sender;

        const sender = await User.findById(senderId);

        if (!sender) {
          logger.warn('Bildirim göndereni bulunamadı', { senderId });
          // Gönderen bulunamadıysa, bildirimi yine de oluştur ama gönderen olmadan
          senderId = undefined;
        }
      }

      // Hedefi kontrol et (varsa)
      let target = undefined;
      if (data.target) {
        target = {
          type: data.target.type,
          id:
            typeof data.target.id === 'string'
              ? new mongoose.Types.ObjectId(data.target.id)
              : data.target.id,
        };
      }

      // Bildirimi oluştur
      const notification = new Notification({
        recipient: recipientId,
        sender: senderId,
        type: data.type,
        content: data.content,
        target,
        priority: data.priority || 'normal',
        expiresAt: data.expiresAt,
        metadata: data.metadata || {},
      });

      await notification.save();

      // Bildirim oluşturulduğunda Socket.IO ile gerçek zamanlı bildirim gönder
      this.sendRealTimeNotification(notification as NotificationDocument);

      logger.info('Bildirim oluşturuldu', {
        notificationId: notification._id,
        recipientId,
        type: data.type,
      });

      return notification as NotificationDocument;
    } catch (error) {
      logger.error('Bildirim oluşturulurken hata oluştu', {
        error: (error as Error).message,
        data,
      });
      return null;
    }
  }

  /**
   * Bildirimi okundu olarak işaretler
   * @param notificationId Bildirim ID
   * @param userId Kullanıcı ID
   * @returns Başarılı mı?
   */
  async markAsRead(
    notificationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const id =
        typeof notificationId === 'string'
          ? new mongoose.Types.ObjectId(notificationId)
          : notificationId;

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // Bildirimi bul ve güncelle
      const result = await Notification.updateOne(
        {
          _id: id,
          recipient: userObjectId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        logger.warn('Bildirim okundu olarak işaretlenemedi', {
          notificationId,
          userId,
        });
        return false;
      }

      logger.info('Bildirim okundu olarak işaretlendi', {
        notificationId,
        userId,
      });

      // Bildirim okunduğunda Socket.IO ile gerçek zamanlı güncelleme gönder
      this.sendNotificationUpdate(id, userObjectId);

      return true;
    } catch (error) {
      logger.error('Bildirim okundu olarak işaretlenirken hata oluştu', {
        error: (error as Error).message,
        notificationId,
        userId,
      });
      return false;
    }
  }

  /**
   * Tüm bildirimleri okundu olarak işaretler
   * @param userId Kullanıcı ID
   * @returns Başarılı mı?
   */
  async markAllAsRead(userId: string | mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // Tüm bildirimleri güncelle
      const result = await Notification.updateMany(
        {
          recipient: userObjectId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      logger.info('Tüm bildirimler okundu olarak işaretlendi', {
        userId,
        count: result.modifiedCount,
      });

      // Tüm bildirimler okunduğunda Socket.IO ile gerçek zamanlı güncelleme gönder
      this.sendAllNotificationsUpdate(userObjectId);

      return true;
    } catch (error) {
      logger.error('Tüm bildirimler okundu olarak işaretlenirken hata oluştu', {
        error: (error as Error).message,
        userId,
      });
      return false;
    }
  }

  /**
   * Bildirimi siler
   * @param notificationId Bildirim ID
   * @param userId Kullanıcı ID
   * @returns Başarılı mı?
   */
  async deleteNotification(
    notificationId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const id =
        typeof notificationId === 'string'
          ? new mongoose.Types.ObjectId(notificationId)
          : notificationId;

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // Bildirimi sil
      const result = await Notification.deleteOne({
        _id: id,
        recipient: userObjectId,
      });

      if (result.deletedCount === 0) {
        logger.warn('Bildirim silinemedi', {
          notificationId,
          userId,
        });
        return false;
      }

      logger.info('Bildirim silindi', {
        notificationId,
        userId,
      });

      // Bildirim silindiğinde Socket.IO ile gerçek zamanlı güncelleme gönder
      this.sendNotificationDeleted(id, userObjectId);

      return true;
    } catch (error) {
      logger.error('Bildirim silinirken hata oluştu', {
        error: (error as Error).message,
        notificationId,
        userId,
      });
      return false;
    }
  }

  /**
   * Tüm bildirimleri siler
   * @param userId Kullanıcı ID
   * @returns Başarılı mı?
   */
  async deleteAllNotifications(userId: string | mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // Tüm bildirimleri sil
      const result = await Notification.deleteMany({
        recipient: userObjectId,
      });

      logger.info('Tüm bildirimler silindi', {
        userId,
        count: result.deletedCount,
      });

      // Tüm bildirimler silindiğinde Socket.IO ile gerçek zamanlı güncelleme gönder
      this.sendAllNotificationsDeleted(userObjectId);

      return true;
    } catch (error) {
      logger.error('Tüm bildirimler silinirken hata oluştu', {
        error: (error as Error).message,
        userId,
      });
      return false;
    }
  }

  /**
   * Kullanıcının bildirimlerini getirir
   * @param userId Kullanıcı ID
   * @param options Seçenekler
   * @returns Bildirimler
   */
  async getUserNotifications(
    userId: string | mongoose.Types.ObjectId,
    options: {
      limit?: number;
      skip?: number;
      isRead?: boolean;
      type?: NotificationType;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    notifications: NotificationDocument[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // Sorgu oluştur
      const query: any = { recipient: userObjectId };

      // Okunma durumuna göre filtrele
      if (options.isRead !== undefined) {
        query.isRead = options.isRead;
      }

      // Türe göre filtrele
      if (options.type) {
        query.type = options.type;
      }

      // Sona erme tarihine göre filtrele
      query.$or = [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }];

      // Toplam sayıyı al
      const total = await Notification.countDocuments(query);

      // Okunmamış bildirimlerin sayısını al
      const unreadCount = await Notification.countDocuments({
        recipient: userObjectId,
        isRead: false,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      });

      // Sıralama seçenekleri
      const sortField = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

      // Bildirimleri getir
      const notifications = await Notification.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(options.skip || 0)
        .limit(options.limit || 20)
        .populate('sender', 'username name surname profilePicture')
        .exec();

      return {
        notifications: notifications as NotificationDocument[],
        total,
        unreadCount,
      };
    } catch (error) {
      logger.error('Kullanıcı bildirimleri getirilirken hata oluştu', {
        error: (error as Error).message,
        userId,
        options,
      });

      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };
    }
  }

  /**
   * Süresi dolmuş bildirimleri temizler
   * @returns Silinen bildirim sayısı
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info('Süresi dolmuş bildirimler temizlendi', {
        count: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('Süresi dolmuş bildirimler temizlenirken hata oluştu', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Gerçek zamanlı bildirim gönderir
   * @param notification Bildirim
   */
  private sendRealTimeNotification(notification: NotificationDocument): void {
    try {
      const recipientId = notification.recipient.toString();

      // Kullanıcının bağlı olduğu tüm soketlere bildirim gönder
      io.to(`user:${recipientId}`).emit('notification:new', {
        notification: {
          _id: notification._id,
          type: notification.type,
          content: notification.content,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          priority: notification.priority,
          sender: notification.sender,
          target: notification.target,
          metadata: notification.metadata,
        },
      });

      logger.debug('Gerçek zamanlı bildirim gönderildi', {
        notificationId: notification._id,
        recipientId,
      });
    } catch (error) {
      logger.error('Gerçek zamanlı bildirim gönderilirken hata oluştu', {
        error: (error as Error).message,
        notificationId: notification._id,
      });
    }
  }

  /**
   * Bildirim güncellemesi gönderir
   * @param notificationId Bildirim ID
   * @param userId Kullanıcı ID
   */
  private sendNotificationUpdate(
    notificationId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): void {
    try {
      const userIdStr = userId.toString();

      // Kullanıcının bağlı olduğu tüm soketlere güncelleme gönder
      io.to(`user:${userIdStr}`).emit('notification:update', {
        notificationId: notificationId.toString(),
        isRead: true,
        readAt: new Date(),
      });

      logger.debug('Bildirim güncellemesi gönderildi', {
        notificationId,
        userId: userIdStr,
      });
    } catch (error) {
      logger.error('Bildirim güncellemesi gönderilirken hata oluştu', {
        error: (error as Error).message,
        notificationId,
        userId,
      });
    }
  }

  /**
   * Tüm bildirimler güncellemesi gönderir
   * @param userId Kullanıcı ID
   */
  private sendAllNotificationsUpdate(userId: mongoose.Types.ObjectId): void {
    try {
      const userIdStr = userId.toString();

      // Kullanıcının bağlı olduğu tüm soketlere güncelleme gönder
      io.to(`user:${userIdStr}`).emit('notification:all_read', {});

      logger.debug('Tüm bildirimler güncellemesi gönderildi', {
        userId: userIdStr,
      });
    } catch (error) {
      logger.error('Tüm bildirimler güncellemesi gönderilirken hata oluştu', {
        error: (error as Error).message,
        userId,
      });
    }
  }

  /**
   * Bildirim silindi bildirimi gönderir
   * @param notificationId Bildirim ID
   * @param userId Kullanıcı ID
   */
  private sendNotificationDeleted(
    notificationId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): void {
    try {
      const userIdStr = userId.toString();

      // Kullanıcının bağlı olduğu tüm soketlere silindi bildirimi gönder
      io.to(`user:${userIdStr}`).emit('notification:deleted', {
        notificationId: notificationId.toString(),
      });

      logger.debug('Bildirim silindi bildirimi gönderildi', {
        notificationId,
        userId: userIdStr,
      });
    } catch (error) {
      logger.error('Bildirim silindi bildirimi gönderilirken hata oluştu', {
        error: (error as Error).message,
        notificationId,
        userId,
      });
    }
  }

  /**
   * Tüm bildirimler silindi bildirimi gönderir
   * @param userId Kullanıcı ID
   */
  private sendAllNotificationsDeleted(userId: mongoose.Types.ObjectId): void {
    try {
      const userIdStr = userId.toString();

      // Kullanıcının bağlı olduğu tüm soketlere silindi bildirimi gönder
      io.to(`user:${userIdStr}`).emit('notification:all_deleted', {});

      logger.debug('Tüm bildirimler silindi bildirimi gönderildi', {
        userId: userIdStr,
      });
    } catch (error) {
      logger.error('Tüm bildirimler silindi bildirimi gönderilirken hata oluştu', {
        error: (error as Error).message,
        userId,
      });
    }
  }

  /**
   * Sistem bildirimi oluşturur
   * @param userId Kullanıcı ID
   * @param message Mesaj
   * @param options Seçenekler
   * @returns Oluşturulan bildirim
   */
  async createSystemNotification(
    userId: string | mongoose.Types.ObjectId,
    message: string,
    options: {
      priority?: 'low' | 'normal' | 'high';
      expiresAt?: Date;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<NotificationDocument | null> {
    return this.createNotification({
      recipient: userId,
      type: NotificationType.SYSTEM,
      content: message,
      priority: options.priority || 'normal',
      expiresAt: options.expiresAt,
      metadata: options.metadata,
    });
  }

  /**
   * Mesaj bildirimi oluşturur
   * @param recipientId Alıcı ID
   * @param senderId Gönderen ID
   * @param messageId Mesaj ID
   * @param messageContent Mesaj içeriği
   * @param channelId Kanal ID
   * @returns Oluşturulan bildirim
   */
  async createMessageNotification(
    recipientId: string | mongoose.Types.ObjectId,
    senderId: string | mongoose.Types.ObjectId,
    messageId: string | mongoose.Types.ObjectId,
    messageContent: string,
    channelId: string | mongoose.Types.ObjectId
  ): Promise<NotificationDocument | null> {
    // Gönderen bilgilerini al
    const sender = await User.findById(senderId).select('username name surname');

    if (!sender) {
      logger.warn('Mesaj bildirimi için gönderen bulunamadı', { senderId });
      return null;
    }

    // Bildirim içeriğini oluştur
    const content = t('notifications.new_message', {
      sender:
        sender.get('name') && sender.get('surname')
          ? `${sender.get('name')} ${sender.get('surname')}`
          : sender.get('username'),
      message:
        messageContent.length > 50 ? `${messageContent.substring(0, 50)}...` : messageContent,
    });

    return this.createNotification({
      recipient: recipientId,
      sender: senderId,
      type: NotificationType.MESSAGE,
      content,
      target: {
        type: 'message',
        id: messageId,
      },
      metadata: {
        channelId: channelId.toString(),
        messageId: messageId.toString(),
        messageContent,
      },
    });
  }
}

// Bildirim servisi örneği
export const notificationService = new NotificationService();

export default notificationService;
