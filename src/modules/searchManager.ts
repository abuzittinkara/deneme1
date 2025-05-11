/**
 * src/modules/searchManager.ts
 * Arama işlemleri modülü
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../models/User';
import { Message, MessageDocument } from '../models/Message';
import { DmMessage, DmMessageDocument } from '../models/DmMessage';
import { Channel, ChannelDocument } from '../models/Channel';
import { Group, GroupDocument } from '../models/Group';
import { GroupMember, GroupMemberDocument } from '../models/GroupMember';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { createModelHelper } from '../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DmMessageHelper = createModelHelper<DmMessageDocument, typeof DmMessage>(DmMessage);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);

// Arama sonucu arayüzü
export interface SearchResult {
  users?: UserSearchResult[];
  messages?: MessageSearchResult[];
  dmMessages?: DmMessageSearchResult[];
  channels?: ChannelSearchResult[];
  groups?: GroupSearchResult[];
  totalCount: number;
}

// Kullanıcı arama sonucu arayüzü
export interface UserSearchResult {
  id: string;
  username: string;
  name?: string;
  surname?: string;
  profilePicture?: string;
  status?: string;
}

// Mesaj arama sonucu arayüzü
export interface MessageSearchResult {
  id: string;
  content: string;
  timestamp: Date;
  user: {
    id: string;
    username: string;
  };
  channel: {
    id: string;
    name: string;
  };
  group: {
    id: string;
    name: string;
  };
  highlightedContent?: string;
}

// DM mesaj arama sonucu arayüzü
export interface DmMessageSearchResult {
  id: string;
  content: string;
  timestamp: Date;
  sender: {
    id: string;
    username: string;
  };
  receiver: {
    id: string;
    username: string;
  };
  highlightedContent?: string;
}

// Kanal arama sonucu arayüzü
export interface ChannelSearchResult {
  id: string;
  name: string;
  description?: string;
  type: string;
  group: {
    id: string;
    name: string;
  };
}

// Grup arama sonucu arayüzü
export interface GroupSearchResult {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  owner: {
    id: string;
    username: string;
  };
}

// Arama seçenekleri arayüzü
export interface SearchOptions {
  limit?: number;
  offset?: number;
  searchType?: 'all' | 'users' | 'messages' | 'dmMessages' | 'channels' | 'groups';
  userId?: string;
  groupId?: string;
  channelId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Genel arama yapar
 * @param query - Arama sorgusu
 * @param options - Arama seçenekleri
 * @returns Arama sonuçları
 */
export async function search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  try {
    if (!query || query.trim().length < 2) {
      throw new ValidationError('Arama sorgusu en az 2 karakter olmalıdır.');
    }

    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const searchType = options.searchType || 'all';

    // Regex oluştur (case insensitive)
    const regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');

    const result: SearchResult = {
      totalCount: 0,
    };

    // Arama türüne göre işlem yap
    if (searchType === 'all' || searchType === 'users') {
      result.users = await searchUsers(regex, limit, offset, options);
      result.totalCount += result.users.length;
    }

    if (searchType === 'all' || searchType === 'messages') {
      result.messages = await searchMessages(regex, limit, offset, options);
      result.totalCount += result.messages.length;
    }

    if (searchType === 'all' || searchType === 'dmMessages') {
      result.dmMessages = await searchDmMessages(regex, limit, offset, options);
      result.totalCount += result.dmMessages.length;
    }

    if (searchType === 'all' || searchType === 'channels') {
      result.channels = await searchChannels(regex, limit, offset, options);
      result.totalCount += result.channels.length;
    }

    if (searchType === 'all' || searchType === 'groups') {
      result.groups = await searchGroups(regex, limit, offset, options);
      result.totalCount += result.groups.length;
    }

    logger.info('Arama yapıldı', {
      query,
      searchType,
      totalCount: result.totalCount,
    });

    return result;
  } catch (error) {
    logger.error('Arama hatası', {
      error: (error as Error).message,
      query,
      options,
    });
    throw error;
  }
}

/**
 * Kullanıcı araması yapar
 * @param regex - Regex sorgu
 * @param limit - Limit
 * @param offset - Offset
 * @param options - Arama seçenekleri
 * @returns Kullanıcı arama sonuçları
 */
async function searchUsers(
  regex: RegExp,
  limit: number,
  offset: number,
  options: SearchOptions
): Promise<UserSearchResult[]> {
  // Kullanıcı araması
  const users = await UserHelper.find({
    $or: [{ username: regex }, { name: regex }, { surname: regex }, { email: regex }],
    isActive: true,
  })
    .sort({ username: 1 })
    .skip(offset)
    .limit(limit)
    .exec();

  return users.map((user) => ({
    id: user._id.toString(),
    username: user.username,
    name: user.name,
    surname: user.surname,
    profilePicture: user.profilePicture?.toString(),
    status: user.status,
  }));
}

/**
 * Mesaj araması yapar
 * @param regex - Regex sorgu
 * @param limit - Limit
 * @param offset - Offset
 * @param options - Arama seçenekleri
 * @returns Mesaj arama sonuçları
 */
async function searchMessages(
  regex: RegExp,
  limit: number,
  offset: number,
  options: SearchOptions
): Promise<MessageSearchResult[]> {
  // Mesaj araması için filtre oluştur
  const filter: any = {
    content: regex,
  };

  // Grup ve kanal filtreleri
  if (options.groupId) {
    const group = await GroupHelper.findOne({ groupId: options.groupId }).exec();
    if (group) {
      const channels = await ChannelHelper.find({ group: group._id }).exec();
      filter.channel = { $in: channels.map((c) => c._id) };
    }
  }

  if (options.channelId) {
    const channel = await ChannelHelper.findOne({ channelId: options.channelId }).exec();
    if (channel) {
      filter.channel = channel._id;
    }
  }

  // Tarih filtreleri
  if (options.startDate || options.endDate) {
    filter.timestamp = {};
    if (options.startDate) {
      filter.timestamp.$gte = options.startDate;
    }
    if (options.endDate) {
      filter.timestamp.$lte = options.endDate;
    }
  }

  // Sıralama seçenekleri
  let sort: any = { timestamp: -1 }; // Varsayılan: en yeni
  if (options.sortBy === 'relevance') {
    sort = { score: { $meta: 'textScore' } };
  } else if (options.sortBy === 'date') {
    sort = { timestamp: options.sortOrder === 'asc' ? 1 : -1 };
  }

  // Mesaj araması
  const messages = await MessageHelper.find(filter)
    .populate('user', 'username')
    .populate('channel', 'channelId name')
    .populateObject({
      path: 'channel',
      populate: {
        path: 'group',
        select: 'groupId name',
      },
    })
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .exec();

  return messages.map((message) => {
    // İçeriği vurgula
    const content = message.content;
    let highlightedContent = content;

    try {
      // Regex ile eşleşen kısmı vurgula
      highlightedContent = content.replace(regex, (match) => `<mark>${match}</mark>`);
    } catch (error) {
      logger.warn('İçerik vurgulama hatası', {
        error: (error as Error).message,
        messageId: message._id,
      });
    }

    return {
      id: message._id.toString(),
      content: message.content,
      timestamp: message.timestamp,
      user: {
        id: (message.user as any)._id.toString(),
        username: (message.user as any).username,
      },
      channel: {
        id: (message.channel as any).channelId,
        name: (message.channel as any).name,
      },
      group: {
        id: (message.channel as any).group?.groupId,
        name: (message.channel as any).group?.name,
      },
      highlightedContent,
    };
  });
}

/**
 * DM mesaj araması yapar
 * @param regex - Regex sorgu
 * @param limit - Limit
 * @param offset - Offset
 * @param options - Arama seçenekleri
 * @returns DM mesaj arama sonuçları
 */
async function searchDmMessages(
  regex: RegExp,
  limit: number,
  offset: number,
  options: SearchOptions
): Promise<DmMessageSearchResult[]> {
  // DM mesaj araması için filtre oluştur
  const filter: any = {
    content: regex,
  };

  // Kullanıcı filtresi
  if (options.userId) {
    filter.$or = [{ sender: options.userId }, { receiver: options.userId }];
  }

  // Tarih filtreleri
  if (options.startDate || options.endDate) {
    filter.timestamp = {};
    if (options.startDate) {
      filter.timestamp.$gte = options.startDate;
    }
    if (options.endDate) {
      filter.timestamp.$lte = options.endDate;
    }
  }

  // Sıralama seçenekleri
  let sort: any = { timestamp: -1 }; // Varsayılan: en yeni
  if (options.sortBy === 'relevance') {
    sort = { score: { $meta: 'textScore' } };
  } else if (options.sortBy === 'date') {
    sort = { timestamp: options.sortOrder === 'asc' ? 1 : -1 };
  }

  // DM mesaj araması
  const dmMessages = await DmMessageHelper.find(filter)
    .populate('sender', 'username')
    .populate('receiver', 'username')
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .exec();

  return dmMessages.map((message) => {
    // İçeriği vurgula
    const content = message.content;
    let highlightedContent = content;

    try {
      // Regex ile eşleşen kısmı vurgula
      highlightedContent = content.replace(regex, (match) => `<mark>${match}</mark>`);
    } catch (error) {
      logger.warn('İçerik vurgulama hatası', {
        error: (error as Error).message,
        messageId: message._id,
      });
    }

    return {
      id: message._id.toString(),
      content: message.content,
      timestamp: message.timestamp,
      sender: {
        id: (message.sender as any)._id.toString(),
        username: (message.sender as any).username,
      },
      receiver: {
        id: (message.receiver as any)._id.toString(),
        username: (message.receiver as any).username,
      },
      highlightedContent,
    };
  });
}

/**
 * Kanal araması yapar
 * @param regex - Regex sorgu
 * @param limit - Limit
 * @param offset - Offset
 * @param options - Arama seçenekleri
 * @returns Kanal arama sonuçları
 */
async function searchChannels(
  regex: RegExp,
  limit: number,
  offset: number,
  options: SearchOptions
): Promise<ChannelSearchResult[]> {
  // Kanal araması için filtre oluştur
  const filter: any = {
    $or: [{ name: regex }, { description: regex }],
    isArchived: false,
  };

  // Grup filtresi
  if (options.groupId) {
    const group = await GroupHelper.findOne({ groupId: options.groupId }).exec();
    if (group) {
      filter.group = group._id;
    }
  }

  // Sıralama seçenekleri
  let sort: any = { name: 1 }; // Varsayılan: isim
  if (options.sortBy === 'relevance') {
    sort = { score: { $meta: 'textScore' } };
  } else if (options.sortBy === 'name') {
    sort = { name: options.sortOrder === 'asc' ? 1 : -1 };
  }

  // Kanal araması
  const channels = await ChannelHelper.find(filter)
    .populate('group', 'groupId name')
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .exec();

  return channels.map((channel) => ({
    id: channel.channelId,
    name: channel.name,
    description: channel.description,
    type: channel.type,
    group: {
      id: (channel.group as any).groupId,
      name: (channel.group as any).name,
    },
  }));
}

/**
 * Grup araması yapar
 * @param regex - Regex sorgu
 * @param limit - Limit
 * @param offset - Offset
 * @param options - Arama seçenekleri
 * @returns Grup arama sonuçları
 */
async function searchGroups(
  regex: RegExp,
  limit: number,
  offset: number,
  options: SearchOptions
): Promise<GroupSearchResult[]> {
  // Grup araması için filtre oluştur
  const filter: any = {
    $or: [{ name: regex }, { description: regex }],
    isPublic: true,
  };

  // Sıralama seçenekleri
  let sort: any = { name: 1 }; // Varsayılan: isim
  if (options.sortBy === 'relevance') {
    sort = { score: { $meta: 'textScore' } };
  } else if (options.sortBy === 'name') {
    sort = { name: options.sortOrder === 'asc' ? 1 : -1 };
  }

  // Grup araması
  const groups = await GroupHelper.find(filter)
    .populate('owner', 'username')
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .exec();

  // Grup üye sayılarını getir
  const groupResults = await Promise.all(
    groups.map(async (group) => {
      const memberCount = await GroupMemberHelper.countDocuments({ group: group._id });

      return {
        id: group.groupId,
        name: group.name,
        description: group.description,
        memberCount,
        owner: {
          id: (group.owner as any)._id.toString(),
          username: (group.owner as any).username,
        },
      };
    })
  );

  return groupResults;
}

export default {
  search,
};
