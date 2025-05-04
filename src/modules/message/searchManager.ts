/**
 * src/modules/message/searchManager.ts
 * Mesaj arama işlemleri
 */
import mongoose from 'mongoose';
import { Message, MessageDocument } from '../../models/Message';
import { DirectMessage, DirectMessageDocument } from '../../models/DirectMessage';
import { Channel, ChannelDocument } from '../../models/Channel';
import { Group, GroupDocument } from '../../models/Group';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { toObjectId } from '../../utils/mongoose-helpers';

// Model yardımcıları
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DirectMessageHelper = createModelHelper<DirectMessageDocument, typeof DirectMessage>(DirectMessage);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);

// Arama parametreleri arayüzü
export interface SearchParams {
  query: string;
  userId: string;
  groupId?: string;
  channelId?: string;
  fromUserId?: string;
  startDate?: Date;
  endDate?: Date;
  hasAttachments?: boolean;
  hasReactions?: boolean;
  isPinned?: boolean;
  limit?: number;
  skip?: number;
}

// Arama sonucu arayüzü
export interface SearchResult {
  messages: any[];
  total: number;
  hasMore: boolean;
}

/**
 * Kanal mesajlarında arama yapar
 * @param params - Arama parametreleri
 * @returns Arama sonuçları
 */
export async function searchChannelMessages(params: SearchParams): Promise<SearchResult> {
  try {
    const {
      query,
      userId,
      groupId,
      channelId,
      fromUserId,
      startDate,
      endDate,
      hasAttachments,
      hasReactions,
      isPinned,
      limit = 20,
      skip = 0
    } = params;

    // Sorgu nesnesi oluştur
    const searchQuery: any = {
      isDeleted: false,
      content: { $regex: query, $options: 'i' }
    };

    // Kanal filtreleme
    if (channelId) {
      searchQuery.channel = toObjectId(channelId);
    } else if (groupId) {
      // Grup ID'sine göre kanalları bul
      const channels = await Channel.find({ group: toObjectId(groupId) });
      searchQuery.channel = { $in: channels.map(c => c._id) };
    }

    // Gönderen kullanıcı filtreleme
    if (fromUserId) {
      searchQuery.user = toObjectId(fromUserId);
    }

    // Tarih aralığı filtreleme
    if (startDate || endDate) {
      searchQuery.timestamp = {};
      if (startDate) searchQuery.timestamp.$gte = startDate;
      if (endDate) searchQuery.timestamp.$lte = endDate;
    }

    // Ek filtreleme
    if (hasAttachments) {
      searchQuery.attachments = { $exists: true, $ne: [] };
    }
    if (hasReactions) {
      searchQuery['reactions.0'] = { $exists: true };
    }
    if (isPinned !== undefined) {
      searchQuery.isPinned = isPinned;
    }

    // Toplam sonuç sayısını hesapla
    const total = await MessageHelper.countDocuments(searchQuery);

    // Mesajları getir
    const messages = await MessageHelper.find(
      searchQuery,
      null,
      {
        sort: { timestamp: -1 },
        skip,
        limit,
        populate: [
          { path: 'user', select: 'username name surname profilePicture' },
          { path: 'channel', select: 'name' },
          {
            path: 'quotedMessage',
            populate: {
              path: 'user',
              select: 'username profilePicture'
            }
          }
        ],
        lean: true
      }
    );

    logger.info('Kanal mesajlarında arama yapıldı', {
      userId,
      query,
      channelId,
      groupId,
      total,
      found: messages.length
    });

    return {
      messages,
      total,
      hasMore: skip + messages.length < total
    };
  } catch (error) {
    logger.error('Kanal mesajlarında arama hatası', {
      error: (error as Error).message,
      userId: params.userId,
      query: params.query
    });
    throw error;
  }
}

/**
 * Direkt mesajlarda arama yapar
 * @param params - Arama parametreleri
 * @returns Arama sonuçları
 */
export async function searchDirectMessages(params: SearchParams): Promise<SearchResult> {
  try {
    const {
      query,
      userId,
      fromUserId,
      startDate,
      endDate,
      hasAttachments,
      hasReactions,
      limit = 20,
      skip = 0
    } = params;

    // Sorgu nesnesi oluştur
    const searchQuery: any = {
      isDeleted: false,
      content: { $regex: query, $options: 'i' },
      $or: [
        { sender: toObjectId(userId) },
        { recipient: toObjectId(userId) }
      ]
    };

    // Belirli bir kullanıcıyla olan mesajlaşma
    if (fromUserId) {
      searchQuery.$or = [
        { sender: toObjectId(userId), recipient: toObjectId(fromUserId) },
        { sender: toObjectId(fromUserId), recipient: toObjectId(userId) }
      ];
    }

    // Tarih aralığı filtreleme
    if (startDate || endDate) {
      searchQuery.timestamp = {};
      if (startDate) searchQuery.timestamp.$gte = startDate;
      if (endDate) searchQuery.timestamp.$lte = endDate;
    }

    // Ek filtreleme
    if (hasAttachments) {
      searchQuery.attachments = { $exists: true, $ne: [] };
    }
    if (hasReactions) {
      searchQuery['reactions.0'] = { $exists: true };
    }

    // Toplam sonuç sayısını hesapla
    const total = await DirectMessageHelper.countDocuments(searchQuery);

    // Mesajları getir
    const messages = await DirectMessageHelper.find(
      searchQuery,
      null,
      {
        sort: { timestamp: -1 },
        skip,
        limit,
        populate: [
          { path: 'sender', select: 'username name surname profilePicture' },
          { path: 'recipient', select: 'username name surname profilePicture' },
          {
            path: 'replyTo',
            populate: {
              path: 'sender',
              select: 'username profilePicture'
            }
          }
        ],
        lean: true
      }
    );

    logger.info('Direkt mesajlarda arama yapıldı', {
      userId,
      query,
      fromUserId,
      total,
      found: messages.length
    });

    return {
      messages,
      total,
      hasMore: skip + messages.length < total
    };
  } catch (error) {
    logger.error('Direkt mesajlarda arama hatası', {
      error: (error as Error).message,
      userId: params.userId,
      query: params.query
    });
    throw error;
  }
}

/**
 * Tüm mesajlarda arama yapar (kanal ve direkt mesajlar)
 * @param params - Arama parametreleri
 * @returns Arama sonuçları
 */
export async function searchAllMessages(params: SearchParams): Promise<SearchResult> {
  try {
    const {
      query,
      userId,
      startDate,
      endDate,
      limit = 20,
      skip = 0
    } = params;

    // Kanal mesajlarında ara
    const channelResults = await searchChannelMessages({
      ...params,
      limit: Math.floor(limit / 2),
      skip: Math.floor(skip / 2)
    });

    // Direkt mesajlarda ara
    const dmResults = await searchDirectMessages({
      ...params,
      limit: Math.ceil(limit / 2),
      skip: Math.ceil(skip / 2)
    });

    // Sonuçları birleştir ve tarihe göre sırala
    const combinedMessages = [...channelResults.messages, ...dmResults.messages]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    const total = channelResults.total + dmResults.total;

    logger.info('Tüm mesajlarda arama yapıldı', {
      userId,
      query,
      total,
      found: combinedMessages.length
    });

    return {
      messages: combinedMessages,
      total,
      hasMore: skip + combinedMessages.length < total
    };
  } catch (error) {
    logger.error('Tüm mesajlarda arama hatası', {
      error: (error as Error).message,
      userId: params.userId,
      query: params.query
    });
    throw error;
  }
}

export default {
  searchChannelMessages,
  searchDirectMessages,
  searchAllMessages
};
