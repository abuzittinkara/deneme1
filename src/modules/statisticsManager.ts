/**
 * src/modules/statisticsManager.ts
 * İstatistik yönetimi modülü
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../models/User';
import { Message, MessageDocument } from '../models/Message';
import { DmMessage, DmMessageDocument } from '../models/DmMessage';
import { Channel, ChannelDocument } from '../models/Channel';
import { Group, GroupDocument } from '../models/Group';
import { GroupMember, GroupMemberDocument } from '../models/GroupMember';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';
import { createModelHelper } from '../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DmMessageHelper = createModelHelper<DmMessageDocument, typeof DmMessage>(DmMessage);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);

// Sistem istatistikleri arayüzü
export interface SystemStats {
  userCount: number;
  activeUserCount: number;
  messageCount: number;
  dmMessageCount: number;
  groupCount: number;
  channelCount: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  topGroups: GroupStats[];
  topChannels: ChannelStats[];
  topUsers: UserStats[];
  messageCountByDay: DailyMessageCount[];
}

// Grup istatistikleri arayüzü
export interface GroupStats {
  id: string;
  name: string;
  memberCount: number;
  messageCount: number;
  channelCount: number;
  createdAt: Date;
}

// Kanal istatistikleri arayüzü
export interface ChannelStats {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  messageCount: number;
  lastActivity: Date;
}

// Kullanıcı istatistikleri arayüzü
export interface UserStats {
  id: string;
  username: string;
  messageCount: number;
  dmMessageCount: number;
  groupCount: number;
  lastActivity: Date;
}

// Günlük mesaj sayısı arayüzü
export interface DailyMessageCount {
  date: string;
  count: number;
}

// Grup istatistikleri arayüzü (detaylı)
export interface DetailedGroupStats extends GroupStats {
  activeUserCount: number;
  messageCountByDay: DailyMessageCount[];
  topChannels: ChannelStats[];
  topUsers: UserStats[];
  messageDistribution: {
    byHour: { hour: number; count: number }[];
    byDayOfWeek: { day: number; count: number }[];
  };
}

// Kullanıcı istatistikleri arayüzü (detaylı)
export interface DetailedUserStats extends UserStats {
  joinedGroups: {
    id: string;
    name: string;
    messageCount: number;
  }[];
  messageCountByDay: DailyMessageCount[];
  activeHours: { hour: number; count: number }[];
  activeDays: { day: number; count: number }[];
}

/**
 * Sistem istatistiklerini getirir
 * @returns Sistem istatistikleri
 */
export async function getSystemStats(): Promise<SystemStats> {
  try {
    // Temel sayılar
    const userCount = await UserHelper.countDocuments({});
    const activeUserCount = await UserHelper.countDocuments({ isActive: true });
    const messageCount = await MessageHelper.countDocuments({});
    const dmMessageCount = await DmMessageHelper.countDocuments({});
    const groupCount = await GroupHelper.countDocuments({});
    const channelCount = await ChannelHelper.countDocuments({});

    // Aktif kullanıcı sayıları
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyActiveUsers = await UserHelper.countDocuments({ lastSeen: { $gte: oneDayAgo } });
    const weeklyActiveUsers = await UserHelper.countDocuments({ lastSeen: { $gte: oneWeekAgo } });
    const monthlyActiveUsers = await UserHelper.countDocuments({ lastSeen: { $gte: oneMonthAgo } });

    // En popüler gruplar
    const topGroups = await getTopGroups(5);

    // En popüler kanallar
    const topChannels = await getTopChannels(5);

    // En aktif kullanıcılar
    const topUsers = await getTopUsers(5);

    // Günlük mesaj sayıları (son 7 gün)
    const messageCountByDay = await getMessageCountByDay(7);

    logger.info('Sistem istatistikleri getirildi');

    return {
      userCount,
      activeUserCount,
      messageCount,
      dmMessageCount,
      groupCount,
      channelCount,
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      topGroups,
      topChannels,
      topUsers,
      messageCountByDay,
    };
  } catch (error) {
    logger.error('Sistem istatistikleri getirme hatası', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * En popüler grupları getirir
 * @param limit - Limit
 * @returns Grup istatistikleri
 */
export async function getTopGroups(limit: number = 10): Promise<GroupStats[]> {
  try {
    // Grup üye sayılarını getir
    const groups = await GroupHelper.find({}).sort({ createdAt: -1 }).limit(limit).exec();

    const groupStats = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await GroupMemberHelper.countDocuments({ group: group._id });
        const messageCount = await MessageHelper.countDocuments({
          channel: {
            $in: await ChannelHelper.getModel().find({ group: group._id }).distinct('_id'),
          },
        });
        const channelCount = await ChannelHelper.countDocuments({ group: group._id });

        return {
          id: group.groupId,
          name: group.name,
          memberCount,
          messageCount,
          channelCount,
          createdAt: group.createdAt,
        };
      })
    );

    // Mesaj sayısına göre sırala
    return groupStats.sort((a, b) => b.messageCount - a.messageCount);
  } catch (error) {
    logger.error('En popüler grupları getirme hatası', {
      error: (error as Error).message,
      limit,
    });
    throw error;
  }
}

/**
 * En popüler kanalları getirir
 * @param limit - Limit
 * @returns Kanal istatistikleri
 */
export async function getTopChannels(limit: number = 10): Promise<ChannelStats[]> {
  try {
    // Kanal mesaj sayılarını getir
    const channels = await ChannelHelper.find({})
      .populate('group', 'groupId name')
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Daha fazla getir, sonra filtreleyeceğiz
      .exec();

    const channelStats = await Promise.all(
      channels.map(async (channel) => {
        const messageCount = await MessageHelper.countDocuments({ channel: channel._id });
        const lastMessage = await MessageHelper.findOne({ channel: channel._id })
          .sort({ timestamp: -1 })
          .limit(1)
          .exec();

        return {
          id: channel.channelId,
          name: channel.name,
          groupId: (channel.group as any).groupId,
          groupName: (channel.group as any).name,
          messageCount,
          lastActivity: lastMessage?.timestamp || channel.createdAt,
        };
      })
    );

    // Mesaj sayısına göre sırala ve limit uygula
    return channelStats.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
  } catch (error) {
    logger.error('En popüler kanalları getirme hatası', {
      error: (error as Error).message,
      limit,
    });
    throw error;
  }
}

/**
 * En aktif kullanıcıları getirir
 * @param limit - Limit
 * @returns Kullanıcı istatistikleri
 */
export async function getTopUsers(limit: number = 10): Promise<UserStats[]> {
  try {
    // Kullanıcıları getir
    const users = await UserHelper.find({ isActive: true })
      .sort({ lastSeen: -1 })
      .limit(limit * 2) // Daha fazla getir, sonra filtreleyeceğiz
      .exec();

    const userStats = await Promise.all(
      users.map(async (user) => {
        const messageCount = await MessageHelper.countDocuments({ user: user._id });
        const dmMessageCount = await DmMessageHelper.countDocuments({
          $or: [{ sender: user._id }, { receiver: user._id }],
        });
        const groupCount = await GroupMemberHelper.countDocuments({ user: user._id });

        // Son aktivite
        const lastMessage = await MessageHelper.findOne({ user: user._id })
          .sort({ timestamp: -1 })
          .limit(1)
          .exec();

        const lastDmMessage = await DmMessageHelper.findOne({
          $or: [{ sender: user._id }, { receiver: user._id }],
        })
          .sort({ timestamp: -1 })
          .limit(1)
          .exec();

        const lastActivity = new Date(
          Math.max(
            user.lastSeen?.getTime() || 0,
            lastMessage?.timestamp.getTime() || 0,
            lastDmMessage?.timestamp.getTime() || 0
          )
        );

        return {
          id: user._id.toString(),
          username: user.username,
          messageCount,
          dmMessageCount,
          groupCount,
          lastActivity,
        };
      })
    );

    // Toplam mesaj sayısına göre sırala ve limit uygula
    return userStats
      .sort((a, b) => b.messageCount + b.dmMessageCount - (a.messageCount + a.dmMessageCount))
      .slice(0, limit);
  } catch (error) {
    logger.error('En aktif kullanıcıları getirme hatası', {
      error: (error as Error).message,
      limit,
    });
    throw error;
  }
}

/**
 * Günlük mesaj sayılarını getirir
 * @param days - Gün sayısı
 * @returns Günlük mesaj sayıları
 */
export async function getMessageCountByDay(days: number = 7): Promise<DailyMessageCount[]> {
  try {
    const result: DailyMessageCount[] = [];
    const now = new Date();

    // Son n gün için
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Mesaj sayılarını getir
      const messageCount = await MessageHelper.countDocuments({
        timestamp: {
          $gte: date,
          $lt: nextDate,
        },
      });

      const dmMessageCount = await DmMessageHelper.countDocuments({
        timestamp: {
          $gte: date,
          $lt: nextDate,
        },
      });

      result.push({
        date: date.toISOString().split('T')[0],
        count: messageCount + dmMessageCount,
      });
    }

    // Tarihe göre sırala (eskiden yeniye)
    return result.reverse();
  } catch (error) {
    logger.error('Günlük mesaj sayılarını getirme hatası', {
      error: (error as Error).message,
      days,
    });
    throw error;
  }
}

/**
 * Grup istatistiklerini getirir
 * @param groupId - Grup ID'si
 * @returns Grup istatistikleri
 */
export async function getGroupStats(groupId: string): Promise<DetailedGroupStats> {
  try {
    const group = await GroupHelper.findOne({ groupId }).populate('owner', 'username').exec();

    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    // Temel istatistikler
    const memberCount = await GroupMemberHelper.countDocuments({ group: group._id });
    const channels = await ChannelHelper.find({ group: group._id }).exec();
    const channelCount = channels.length;

    // Mesaj sayısı
    const messageCount = await MessageHelper.countDocuments({
      channel: { $in: channels.map((c) => c._id) },
    });

    // Aktif kullanıcı sayısı (son 7 gün)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const activeUserIds = await MessageHelper.getModel().distinct('user', {
      channel: { $in: channels.map((c) => c._id) },
      timestamp: { $gte: oneWeekAgo },
    });

    const activeUserCount = activeUserIds.length;

    // Günlük mesaj sayıları (son 30 gün)
    const messageCountByDay = await getGroupMessageCountByDay(toObjectId(group._id), 30);

    // En popüler kanallar
    const topChannels = await getGroupTopChannels(toObjectId(group._id), 5);

    // En aktif kullanıcılar
    const topUsers = await getGroupTopUsers(toObjectId(group._id), 5);

    // Mesaj dağılımı
    const messageDistribution = await getGroupMessageDistribution(toObjectId(group._id));

    logger.info('Grup istatistikleri getirildi', { groupId });

    return {
      id: group.groupId,
      name: group.name,
      memberCount,
      messageCount,
      channelCount,
      createdAt: group.createdAt,
      activeUserCount,
      messageCountByDay,
      topChannels,
      topUsers,
      messageDistribution,
    };
  } catch (error) {
    logger.error('Grup istatistikleri getirme hatası', {
      error: (error as Error).message,
      groupId,
    });
    throw error;
  }
}

/**
 * Grup için günlük mesaj sayılarını getirir
 * @param groupId - Grup ID'si
 * @param days - Gün sayısı
 * @returns Günlük mesaj sayıları
 */
async function getGroupMessageCountByDay(
  groupId: mongoose.Types.ObjectId,
  days: number = 30
): Promise<DailyMessageCount[]> {
  const result: DailyMessageCount[] = [];
  const now = new Date();

  // Kanalları getir
  const channels = await ChannelHelper.find({ group: groupId }).exec();
  const channelIds = channels.map((c) => c._id);

  // Son n gün için
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    // Mesaj sayısını getir
    const count = await MessageHelper.countDocuments({
      channel: { $in: channelIds },
      timestamp: {
        $gte: date,
        $lt: nextDate,
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  // Tarihe göre sırala (eskiden yeniye)
  return result.reverse();
}

/**
 * Grup için en popüler kanalları getirir
 * @param groupId - Grup ID'si
 * @param limit - Limit
 * @returns Kanal istatistikleri
 */
async function getGroupTopChannels(
  groupId: mongoose.Types.ObjectId,
  limit: number = 5
): Promise<ChannelStats[]> {
  // Kanalları getir
  const channels = await ChannelHelper.find({ group: groupId })
    .populate('group', 'groupId name')
    .exec();

  const channelStats = await Promise.all(
    channels.map(async (channel) => {
      const messageCount = await MessageHelper.countDocuments({ channel: channel._id });
      const lastMessage = await MessageHelper.findOne({ channel: channel._id })
        .sort({ timestamp: -1 })
        .limit(1)
        .exec();

      return {
        id: channel.channelId,
        name: channel.name,
        groupId: (channel.group as any).groupId,
        groupName: (channel.group as any).name,
        messageCount,
        lastActivity: lastMessage?.timestamp || channel.createdAt,
      };
    })
  );

  // Mesaj sayısına göre sırala ve limit uygula
  return channelStats.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
}

/**
 * Grup için en aktif kullanıcıları getirir
 * @param groupId - Grup ID'si
 * @param limit - Limit
 * @returns Kullanıcı istatistikleri
 */
async function getGroupTopUsers(
  groupId: mongoose.Types.ObjectId,
  limit: number = 5
): Promise<UserStats[]> {
  // Grup üyelerini getir
  const members = await GroupMemberHelper.find({ group: groupId })
    .populate('user', 'username lastSeen')
    .exec();

  // Kanalları getir
  const channels = await ChannelHelper.find({ group: groupId }).exec();
  const channelIds = channels.map((c) => c._id);

  const userStats = await Promise.all(
    members.map(async (member) => {
      const user = member.user as any;

      // Mesaj sayısını getir
      const messageCount = await MessageHelper.countDocuments({
        user: user._id,
        channel: { $in: channelIds },
      });

      // DM mesaj sayısını getir (tüm DM'ler)
      const dmMessageCount = await DmMessageHelper.countDocuments({
        $or: [{ sender: user._id }, { receiver: user._id }],
      });

      // Kullanıcının üye olduğu grup sayısı
      const groupCount = await GroupMemberHelper.countDocuments({ user: user._id });

      // Son aktivite
      const lastMessage = await MessageHelper.findOne({
        user: user._id,
        channel: { $in: channelIds },
      })
        .sort({ timestamp: -1 })
        .limit(1)
        .exec();

      const lastActivity = lastMessage?.timestamp || user.lastSeen || new Date();

      return {
        id: user._id.toString(),
        username: user.username,
        messageCount,
        dmMessageCount,
        groupCount,
        lastActivity,
      };
    })
  );

  // Grup içindeki mesaj sayısına göre sırala ve limit uygula
  return userStats.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
}

/**
 * Grup için mesaj dağılımını getirir
 * @param groupId - Grup ID'si
 * @returns Mesaj dağılımı
 */
async function getGroupMessageDistribution(groupId: mongoose.Types.ObjectId): Promise<{
  byHour: { hour: number; count: number }[];
  byDayOfWeek: { day: number; count: number }[];
}> {
  // Kanalları getir
  const channels = await ChannelHelper.find({ group: groupId }).exec();
  const channelIds = channels.map((c) => c._id);

  // Saate göre dağılım
  const byHour: { hour: number; count: number }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const messages = await MessageHelper.find({
      channel: { $in: channelIds },
    }).exec();

    // Saate göre filtrele
    const count = messages.filter((msg) => {
      const msgHour = msg.timestamp.getHours();
      return msgHour === hour;
    }).length;

    byHour.push({ hour, count });
  }

  // Haftanın gününe göre dağılım
  const byDayOfWeek: { day: number; count: number }[] = [];
  for (let day = 0; day < 7; day++) {
    const messages = await MessageHelper.find({
      channel: { $in: channelIds },
    }).exec();

    // Güne göre filtrele
    const count = messages.filter((msg) => {
      const msgDay = msg.timestamp.getDay();
      return msgDay === day;
    }).length;

    byDayOfWeek.push({ day, count });
  }

  return { byHour, byDayOfWeek };
}

/**
 * Kullanıcı istatistiklerini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Kullanıcı istatistikleri
 */
export async function getUserStats(userId: string): Promise<DetailedUserStats> {
  try {
    const user = await UserHelper.findById(userId).exec();
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Temel istatistikler
    const messageCount = await MessageHelper.countDocuments({ user: user._id });
    const dmMessageCount = await DmMessageHelper.countDocuments({
      $or: [{ sender: user._id }, { receiver: user._id }],
    });

    // Kullanıcının üye olduğu gruplar
    const memberships = await GroupMemberHelper.find({ user: user._id })
      .populate('group', 'groupId name')
      .exec();

    const groupCount = memberships.length;

    // Son aktivite
    const lastMessage = await MessageHelper.findOne({ user: user._id })
      .sort({ timestamp: -1 })
      .limit(1)
      .exec();

    const lastDmMessage = await DmMessageHelper.findOne({
      $or: [{ sender: user._id }, { receiver: user._id }],
    })
      .sort({ timestamp: -1 })
      .limit(1)
      .exec();

    const lastActivity = new Date(
      Math.max(
        user.lastSeen?.getTime() || 0,
        lastMessage?.timestamp.getTime() || 0,
        lastDmMessage?.timestamp.getTime() || 0
      )
    );

    // Katıldığı gruplar ve mesaj sayıları
    const joinedGroups = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group as any;

        // Grup kanallarını getir
        const channels = await ChannelHelper.find({ group: group._id }).exec();

        // Kullanıcının gruptaki mesaj sayısı
        const messageCount = await MessageHelper.countDocuments({
          user: user._id,
          channel: { $in: channels.map((c) => c._id) },
        });

        return {
          id: group.groupId,
          name: group.name,
          messageCount,
        };
      })
    );

    // Günlük mesaj sayıları (son 30 gün)
    const messageCountByDay = await getUserMessageCountByDay(toObjectId(user._id), 30);

    // Aktif saatler
    const activeHours = await getUserActiveHours(toObjectId(user._id));

    // Aktif günler
    const activeDays = await getUserActiveDays(toObjectId(user._id));

    logger.info('Kullanıcı istatistikleri getirildi', { userId });

    return {
      id: user._id.toString(),
      username: user.username,
      messageCount,
      dmMessageCount,
      groupCount,
      lastActivity,
      joinedGroups,
      messageCountByDay,
      activeHours,
      activeDays,
    };
  } catch (error) {
    logger.error('Kullanıcı istatistikleri getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcı için günlük mesaj sayılarını getirir
 * @param userId - Kullanıcı ID'si
 * @param days - Gün sayısı
 * @returns Günlük mesaj sayıları
 */
async function getUserMessageCountByDay(
  userId: mongoose.Types.ObjectId,
  days: number = 30
): Promise<DailyMessageCount[]> {
  const result: DailyMessageCount[] = [];
  const now = new Date();

  // Son n gün için
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    // Mesaj sayılarını getir
    const messageCount = await MessageHelper.countDocuments({
      user: userId,
      timestamp: {
        $gte: date,
        $lt: nextDate,
      },
    });

    const dmMessageCount = await DmMessageHelper.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      timestamp: {
        $gte: date,
        $lt: nextDate,
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count: messageCount + dmMessageCount,
    });
  }

  // Tarihe göre sırala (eskiden yeniye)
  return result.reverse();
}

/**
 * Kullanıcının aktif saatlerini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Aktif saatler
 */
async function getUserActiveHours(
  userId: mongoose.Types.ObjectId
): Promise<{ hour: number; count: number }[]> {
  const result: { hour: number; count: number }[] = [];

  // Tüm mesajları getir
  const messages = await MessageHelper.find({ user: userId }).exec();
  const dmMessages = await DmMessageHelper.find({
    $or: [{ sender: userId }, { receiver: userId }],
  }).exec();

  // Saate göre dağılım
  for (let hour = 0; hour < 24; hour++) {
    // Saate göre filtrele
    const messageCount = messages.filter((msg) => {
      const msgHour = msg.timestamp.getHours();
      return msgHour === hour;
    }).length;

    const dmMessageCount = dmMessages.filter((msg) => {
      const msgHour = msg.timestamp.getHours();
      return msgHour === hour;
    }).length;

    result.push({ hour, count: messageCount + dmMessageCount });
  }

  return result;
}

/**
 * Kullanıcının aktif günlerini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Aktif günler
 */
async function getUserActiveDays(
  userId: mongoose.Types.ObjectId
): Promise<{ day: number; count: number }[]> {
  const result: { day: number; count: number }[] = [];

  // Tüm mesajları getir
  const messages = await MessageHelper.find({ user: userId }).exec();
  const dmMessages = await DmMessageHelper.find({
    $or: [{ sender: userId }, { receiver: userId }],
  }).exec();

  // Güne göre dağılım
  for (let day = 0; day < 7; day++) {
    // Güne göre filtrele
    const messageCount = messages.filter((msg) => {
      const msgDay = msg.timestamp.getDay();
      return msgDay === day;
    }).length;

    const dmMessageCount = dmMessages.filter((msg) => {
      const msgDay = msg.timestamp.getDay();
      return msgDay === day;
    }).length;

    result.push({ day, count: messageCount + dmMessageCount });
  }

  return result;
}

export default {
  getSystemStats,
  getTopGroups,
  getTopChannels,
  getTopUsers,
  getMessageCountByDay,
  getGroupStats,
  getUserStats,
};
