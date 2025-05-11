/**
 * src/modules/user/activityManager.ts
 * Kullanıcı aktivite geçmişi işlemleri
 */
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { UserActivity, ActivityType } from '../../models/UserActivity';
import { Message } from '../../models/Message';
import { DirectMessage } from '../../models/DirectMessage';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';
import { toObjectId } from '../../types/mongoose';

// Aktivite geçmişi parametreleri
export interface ActivityHistoryParams {
  userId: string;
  types?: ActivityType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

// Aktivite geçmişi sonucu
export interface ActivityHistoryResult {
  activities: any[];
  total: number;
  hasMore: boolean;
}

/**
 * Kullanıcı aktivite geçmişini getirir
 * @param params - Aktivite geçmişi parametreleri
 * @returns Aktivite geçmişi
 */
export async function getActivityHistory(
  params: ActivityHistoryParams
): Promise<ActivityHistoryResult> {
  try {
    const { userId, types, startDate, endDate, limit = 20, skip = 0 } = params;

    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Sorgu nesnesi oluştur
    const query: any = { user: toObjectId(userId) };

    // Aktivite türü filtreleme
    if (types && types.length > 0) {
      query.type = { $in: types };
    }

    // Tarih aralığı filtreleme
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Toplam sonuç sayısını hesapla
    const total = await (UserActivity as any).countDocuments(query);

    // Aktiviteleri getir
    const activities = await (UserActivity as any)
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'target.id',
        select: 'name username content',
        options: { lean: true },
      });

    // Aktiviteleri formatla
    const formattedActivities = activities.map((activity: any) => {
      const result: any = {
        id: activity._id.toString(),
        type: activity.type,
        timestamp: activity.timestamp,
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
      };

      // Hedef bilgisini ekle (varsa)
      if (activity.target) {
        result.target = {
          type: activity.target.type,
          id: activity.target.id.toString(),
          name:
            (activity.target.id as any)?.name || (activity.target.id as any)?.username || 'Unknown',
        };
      }

      // Ek bilgileri ekle (varsa)
      if (activity.metadata) {
        result.metadata = activity.metadata;
      }

      return result;
    });

    logger.debug('Kullanıcı aktivite geçmişi getirildi', {
      userId,
      total,
      found: formattedActivities.length,
    });

    return {
      activities: formattedActivities,
      total,
      hasMore: skip + formattedActivities.length < total,
    };
  } catch (error) {
    logger.error('Kullanıcı aktivite geçmişi getirme hatası', {
      error: (error as Error).message,
      userId: params.userId,
    });
    throw error;
  }
}

/**
 * Kullanıcının mesaj aktivitelerini getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Limit
 * @returns Mesaj aktiviteleri
 */
export async function getMessageActivity(userId: string, limit: number = 20): Promise<any[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kanal mesajlarını getir
    const channelMessages = await (Message as any)
      .find({ user: toObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit / 2)
      .populate('channel', 'name')
      .lean();

    // Direkt mesajları getir
    const directMessages = await (DirectMessage as any)
      .find({ sender: toObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit / 2)
      .populate('recipient', 'username')
      .lean();

    // Mesajları formatla
    const formattedChannelMessages = channelMessages.map((message: any) => ({
      id: message._id.toString(),
      type: 'channel_message',
      content: message.content,
      timestamp: message.timestamp,
      channel: {
        id: (message.channel as any)._id.toString(),
        name: (message.channel as any).name,
      },
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
    }));

    const formattedDirectMessages = directMessages.map((message: any) => ({
      id: message._id.toString(),
      type: 'direct_message',
      content: message.content,
      timestamp: message.timestamp,
      recipient: {
        id: (message.recipient as any)._id.toString(),
        username: (message.recipient as any).username,
      },
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
    }));

    // Tüm mesajları birleştir ve tarihe göre sırala
    const allMessages = [...formattedChannelMessages, ...formattedDirectMessages]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    logger.debug('Kullanıcı mesaj aktivitesi getirildi', {
      userId,
      count: allMessages.length,
    });

    return allMessages;
  } catch (error) {
    logger.error('Kullanıcı mesaj aktivitesi getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcının giriş aktivitelerini getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Limit
 * @returns Giriş aktiviteleri
 */
export async function getLoginActivity(userId: string, limit: number = 20): Promise<any[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Giriş aktivitelerini getir
    const loginActivities = await (UserActivity as any)
      .find({
        user: toObjectId(userId),
        type: ActivityType.LOGIN,
      })
      .sort({ timestamp: -1 })
      .limit(limit);

    // Aktiviteleri formatla
    const formattedActivities = loginActivities.map((activity: any) => ({
      id: activity._id.toString(),
      timestamp: activity.timestamp,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      device: activity.metadata?.device,
      location: activity.metadata?.location,
    }));

    logger.debug('Kullanıcı giriş aktivitesi getirildi', {
      userId,
      count: formattedActivities.length,
    });

    return formattedActivities;
  } catch (error) {
    logger.error('Kullanıcı giriş aktivitesi getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

export default {
  getActivityHistory,
  getMessageActivity,
  getLoginActivity,
};
