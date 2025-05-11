/**
 * src/modules/message/unreadManager.ts
 * Okunmamış mesaj yönetimi
 */
import mongoose from 'mongoose';
import { Message, MessageDocument } from '../../models/Message';
import { DirectMessage, DirectMessageDocument } from '../../models/DirectMessage';
import { Channel, ChannelDocument } from '../../models/Channel';
import { Group, GroupDocument } from '../../models/Group';
import { User, UserDocument } from '../../models/User';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';
import { toObjectId } from '../../utils/mongoose-helpers';
import { redisClient } from '../../config/redis';

// Model yardımcıları
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DirectMessageHelper = createModelHelper<DirectMessageDocument, typeof DirectMessage>(
  DirectMessage
);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Okunmamış mesaj sayısı arayüzü
export interface UnreadCountResult {
  total: number;
  channels: { [channelId: string]: number };
  directMessages: { [userId: string]: number };
}

// Okunmamış mesaj arayüzü
export interface UnreadMessagesResult {
  channelMessages: any[];
  directMessages: any[];
}

/**
 * Kullanıcının okunmamış mesaj sayısını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Okunmamış mesaj sayısı
 */
export async function getUnreadMessageCount(userId: string): Promise<UnreadCountResult> {
  try {
    // Redis'ten önbelleklenmiş veriyi kontrol et
    const cacheKey = `unread:count:${userId}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcının üye olduğu kanalları bul
    const channels = await ChannelHelper.find({
      members: toObjectId(userId),
    });

    // Kanal mesajlarını kontrol et
    const channelCounts: { [channelId: string]: number } = {};
    let totalChannelUnread = 0;

    await Promise.all(
      channels.map(async (channel) => {
        const count = await MessageHelper.countDocuments({
          channel: channel._id,
          'readReceipts.user': { $ne: toObjectId(userId) },
          user: { $ne: toObjectId(userId) }, // Kendi mesajlarını sayma
          isDeleted: false,
        });

        if (count > 0) {
          channelCounts[channel._id.toString()] = count;
          totalChannelUnread += count;
        }
      })
    );

    // Direkt mesajları kontrol et
    const dmCounts: { [userId: string]: number } = {};
    let totalDMUnread = 0;

    const unreadDMs = await DirectMessageHelper.find(
      {
        recipient: toObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      null,
      { populate: { path: 'sender', select: 'username' } }
    );

    unreadDMs.forEach((dm) => {
      const senderId = dm.sender._id.toString();
      if (!dmCounts[senderId]) {
        dmCounts[senderId] = 0;
      }
      dmCounts[senderId]++;
      totalDMUnread++;
    });

    const result: UnreadCountResult = {
      total: totalChannelUnread + totalDMUnread,
      channels: channelCounts,
      directMessages: dmCounts,
    };

    // Sonucu önbelleğe al (30 saniye TTL)
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 30);

    logger.debug('Okunmamış mesaj sayısı getirildi', {
      userId,
      total: result.total,
    });

    return result;
  } catch (error) {
    logger.error('Okunmamış mesaj sayısı getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcının okunmamış mesajlarını getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Limit
 * @returns Okunmamış mesajlar
 */
export async function getUnreadMessages(
  userId: string,
  limit: number = 50
): Promise<UnreadMessagesResult> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Okunmamış kanal mesajlarını getir
    const channelMessages = await MessageHelper.find(
      {
        'readReceipts.user': { $ne: toObjectId(userId) },
        user: { $ne: toObjectId(userId) },
        isDeleted: false,
      },
      null,
      {
        limit,
        populate: [
          { path: 'user', select: 'username name surname profilePicture' },
          { path: 'channel', select: 'name' },
        ],
        lean: true,
      }
    );

    // Okunmamış direkt mesajları getir
    const directMessages = await DirectMessageHelper.find(
      {
        recipient: toObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      null,
      {
        limit,
        populate: { path: 'sender', select: 'username name surname profilePicture' },
        lean: true,
      }
    );

    logger.debug('Okunmamış mesajlar getirildi', {
      userId,
      channelCount: channelMessages.length,
      dmCount: directMessages.length,
    });

    return {
      channelMessages,
      directMessages,
    };
  } catch (error) {
    logger.error('Okunmamış mesajları getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kanal mesajını okundu olarak işaretler
 * @param messageId - Mesaj ID'si
 * @param userId - Kullanıcı ID'si
 */
export async function markChannelMessageAsRead(messageId: string, userId: string): Promise<void> {
  try {
    // Okundu bilgisini ekle
    await MessageHelper.getModel().updateOne(
      { _id: toObjectId(messageId) },
      { $addToSet: { readReceipts: { user: toObjectId(userId), readAt: new Date() } } }
    );

    // Önbelleği temizle
    await redisClient.del(`unread:count:${userId}`);

    logger.debug('Kanal mesajı okundu olarak işaretlendi', {
      messageId,
      userId,
    });
  } catch (error) {
    logger.error('Kanal mesajını okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      messageId,
      userId,
    });
    throw error;
  }
}

/**
 * Direkt mesajı okundu olarak işaretler
 * @param messageId - Mesaj ID'si
 * @param userId - Kullanıcı ID'si
 */
export async function markDirectMessageAsRead(messageId: string, userId: string): Promise<void> {
  try {
    // Okundu bilgisini güncelle
    await DirectMessageHelper.getModel().updateOne(
      { _id: toObjectId(messageId), recipient: toObjectId(userId) },
      { $set: { isRead: true, readAt: new Date() } }
    );

    // Önbelleği temizle
    await redisClient.del(`unread:count:${userId}`);

    logger.debug('Direkt mesaj okundu olarak işaretlendi', {
      messageId,
      userId,
    });
  } catch (error) {
    logger.error('Direkt mesajı okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      messageId,
      userId,
    });
    throw error;
  }
}

/**
 * Kanaldaki tüm mesajları okundu olarak işaretler
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşaretlenen mesaj sayısı
 */
export async function markAllChannelMessagesAsRead(
  channelId: string,
  userId: string
): Promise<number> {
  try {
    // Okunmamış mesajları bul
    const unreadMessages = await MessageHelper.find({
      channel: toObjectId(channelId),
      'readReceipts.user': { $ne: toObjectId(userId) },
      user: { $ne: toObjectId(userId) }, // Kendi mesajlarını işaretleme
      isDeleted: false,
    });

    // Her mesajı okundu olarak işaretle
    await Promise.all(
      unreadMessages.map(async (message) => {
        // Okundu bilgisini ekle
        await MessageHelper.getModel().updateOne(
          { _id: message._id },
          { $addToSet: { readReceipts: { user: toObjectId(userId), readAt: new Date() } } }
        );
      })
    );

    // Önbelleği temizle
    await redisClient.del(`unread:count:${userId}`);

    logger.info('Kanaldaki tüm mesajlar okundu olarak işaretlendi', {
      channelId,
      userId,
      count: unreadMessages.length,
    });

    return unreadMessages.length;
  } catch (error) {
    logger.error('Kanaldaki tüm mesajları okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      channelId,
      userId,
    });
    throw error;
  }
}

/**
 * Bir kullanıcıdan gelen tüm direkt mesajları okundu olarak işaretler
 * @param senderId - Gönderen kullanıcı ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşaretlenen mesaj sayısı
 */
export async function markAllDirectMessagesAsRead(
  senderId: string,
  userId: string
): Promise<number> {
  try {
    // Okunmamış mesajları bul
    const result = await DirectMessageHelper.updateMany(
      {
        sender: toObjectId(senderId),
        recipient: toObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    // Önbelleği temizle
    await redisClient.del(`unread:count:${userId}`);

    logger.info('Tüm direkt mesajlar okundu olarak işaretlendi', {
      senderId,
      userId,
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Tüm direkt mesajları okundu olarak işaretleme hatası', {
      error: (error as Error).message,
      senderId,
      userId,
    });
    throw error;
  }
}

export default {
  getUnreadMessageCount,
  getUnreadMessages,
  markChannelMessageAsRead,
  markDirectMessageAsRead,
  markAllChannelMessagesAsRead,
  markAllDirectMessagesAsRead,
};
