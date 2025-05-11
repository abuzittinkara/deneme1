/**
 * src/modules/group/statsManager.ts
 * Grup istatistikleri yönetimi
 */
import mongoose from 'mongoose';
import { Group, GroupDocument } from '../../models/Group';
import { Channel, ChannelDocument } from '../../models/Channel';
import { Message, MessageDocument } from '../../models/Message';
import { GroupMember, GroupMemberDocument } from '../../models/GroupMember';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';
import { redisClient } from '../../config/redis';
import { createModelHelper } from '../../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);

// Grup istatistikleri arayüzü
export interface GroupStats {
  totalMembers: number;
  activeMembers: number;
  totalMessages: number;
  messagesLastDay: number;
  messagesLastWeek: number;
  messagesLastMonth: number;
  topChannels: {
    id: string;
    name: string;
    messageCount: number;
  }[];
  topPosters: {
    id: string;
    username: string;
    messageCount: number;
  }[];
  memberJoinsByMonth: {
    month: string;
    count: number;
  }[];
  messagesByDay: {
    date: string;
    count: number;
  }[];
}

/**
 * Grup istatistiklerini getirir
 * @param groupId - Grup ID'si
 * @returns Grup istatistikleri
 */
export async function getGroupStats(groupId: string): Promise<GroupStats> {
  try {
    // Önbellekten kontrol et
    const cacheKey = `group:stats:${groupId}`;
    const cachedStats = await redisClient.get(cacheKey);

    if (cachedStats) {
      return JSON.parse(cachedStats);
    }

    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Grup kanallarını bul
    const channels = await ChannelHelper.find({ group: group._id }).exec();
    const channelIds = channels.map((channel) => channel._id);

    // Toplam üye sayısı
    const totalMembers = await GroupMemberHelper.countDocuments({ group: group._id });

    // Aktif üye sayısı (son 30 gün içinde mesaj gönderenler)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUserIds = await MessageHelper.getModel().distinct('user', {
      channel: { $in: channelIds },
      timestamp: { $gte: thirtyDaysAgo },
    });

    const activeMembers = activeUserIds.length;

    // Toplam mesaj sayısı
    const totalMessages = await MessageHelper.countDocuments({
      channel: { $in: channelIds },
    });

    // Son gün, hafta ve ay mesaj sayıları
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const messagesLastDay = await MessageHelper.countDocuments({
      channel: { $in: channelIds },
      timestamp: { $gte: oneDayAgo },
    });

    const messagesLastWeek = await MessageHelper.countDocuments({
      channel: { $in: channelIds },
      timestamp: { $gte: oneWeekAgo },
    });

    const messagesLastMonth = await MessageHelper.countDocuments({
      channel: { $in: channelIds },
      timestamp: { $gte: oneMonthAgo },
    });

    // En aktif kanallar
    const topChannelsData = await MessageHelper.getModel().aggregate([
      {
        $match: {
          channel: { $in: channelIds },
        },
      },
      {
        $group: {
          _id: '$channel',
          messageCount: { $sum: 1 },
        },
      },
      {
        $sort: { messageCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: 'channels',
          localField: '_id',
          foreignField: '_id',
          as: 'channelInfo',
        },
      },
      {
        $unwind: '$channelInfo',
      },
      {
        $project: {
          id: '$_id',
          name: '$channelInfo.name',
          messageCount: 1,
        },
      },
    ]);

    // En çok mesaj gönderenler
    const topPostersData = await MessageHelper.getModel().aggregate([
      {
        $match: {
          channel: { $in: channelIds },
        },
      },
      {
        $group: {
          _id: '$user',
          messageCount: { $sum: 1 },
        },
      },
      {
        $sort: { messageCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $project: {
          id: '$_id',
          username: '$userInfo.username',
          messageCount: 1,
        },
      },
    ]);

    // Aylara göre üye katılımları
    const memberJoinsByMonthData = await GroupMemberHelper.getModel().aggregate([
      {
        $match: {
          group: group._id,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$joinedAt' },
            month: { $month: '$joinedAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' },
                },
              },
            ],
          },
          count: 1,
        },
      },
    ]);

    // Günlere göre mesaj sayıları (son 30 gün)
    const messagesByDayData = await MessageHelper.getModel().aggregate([
      {
        $match: {
          channel: { $in: channelIds },
          timestamp: { $gte: oneMonthAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' },
                },
              },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.day', 10] },
                  then: { $concat: ['0', { $toString: '$_id.day' }] },
                  else: { $toString: '$_id.day' },
                },
              },
            ],
          },
          count: 1,
        },
      },
    ]);

    // İstatistikleri oluştur
    const stats: GroupStats = {
      totalMembers,
      activeMembers,
      totalMessages,
      messagesLastDay,
      messagesLastWeek,
      messagesLastMonth,
      topChannels: topChannelsData.map((channel) => ({
        id: channel.id.toString(),
        name: channel.name,
        messageCount: channel.messageCount,
      })),
      topPosters: topPostersData.map((poster) => ({
        id: poster.id.toString(),
        username: poster.username,
        messageCount: poster.messageCount,
      })),
      memberJoinsByMonth: memberJoinsByMonthData,
      messagesByDay: messagesByDayData,
    };

    // İstatistikleri önbelleğe al (1 saat TTL)
    await redisClient.set(cacheKey, JSON.stringify(stats), 'EX', 3600);

    logger.info('Grup istatistikleri getirildi', {
      groupId,
      totalMembers,
      totalMessages,
    });

    return stats;
  } catch (error) {
    logger.error('Grup istatistiklerini getirme hatası', {
      error: (error as Error).message,
      groupId,
    });
    throw error;
  }
}

export default {
  getGroupStats,
};
