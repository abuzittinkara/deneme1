/**
 * src/services/messageService.ts
 * Mesaj servisi - Sayfalama ve filtreleme örnekleri
 */
import mongoose from 'mongoose';
import { PaginationParams, createPaginationMeta, paginatedResponse } from '../middleware/pagination';
import { createDateRangeFilter, createSearchFilter } from '../middleware/filtering';
import { getCachedData } from '../config/redis';
import { CommonModelStaticMethods } from '../types/mongoose-types';

// Mesaj modeli için tip tanımı (tam model tanımı ayrı dosyada olacak)
interface MessageDocument extends mongoose.Document {
  channel: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  attachments: mongoose.Types.ObjectId[];
  reactions: Map<string, mongoose.Types.ObjectId[]>;
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
  quotedMessage?: mongoose.Types.ObjectId;
}

// Mesaj modeli için tip (tam model tanımı ayrı dosyada olacak)
interface MessageModel extends CommonModelStaticMethods<MessageDocument> {
  // Özel metodlar buraya eklenebilir
}

// Mesaj servisi
export class MessageService {
  private Message: MessageModel;

  constructor(messageModel: MessageModel) {
    this.Message = messageModel;
  }

  /**
   * Kanal mesajlarını sayfalı olarak getirir
   * @param channelId - Kanal ID
   * @param pagination - Sayfalama parametreleri
   * @param filters - Filtreleme parametreleri
   */
  async getChannelMessages(
    channelId: string,
    pagination: PaginationParams,
    filters: Record<string, any> = {}
  ) {
    // Önbellek anahtarı oluştur
    const cacheKey = `channel:${channelId}:messages:${JSON.stringify(pagination)}:${JSON.stringify(filters)}`;

    // Önbellekli veri getirme
    return await getCachedData(
      cacheKey,
      async () => {
        // Temel sorgu
        const query: Record<string, any> = {
          channel: new mongoose.Types.ObjectId(channelId),
          isDeleted: filters.includeDeleted ? { $in: [true, false] } : false
        };

        // Tarih aralığı filtresi ekle
        if (filters.startDate || filters.endDate) {
          Object.assign(query, createDateRangeFilter('timestamp', filters.startDate, filters.endDate));
        }

        // Arama filtresi ekle
        if (filters.search) {
          Object.assign(query, createSearchFilter(['content'], filters.search));
        }

        // Kullanıcı filtresi ekle
        if (filters.userId) {
          query.user = new mongoose.Types.ObjectId(filters.userId);
        }

        // Sabitlenen mesajlar filtresi
        if (filters.pinned === 'true' || filters.pinned === true) {
          query.isPinned = true;
        }

        // Toplam mesaj sayısını getir
        const total = await this.Message.countDocuments(query);

        // Mesajları getir
        const messageQuery = (this.Message.find(query) as any)
          .sort({ timestamp: filters.sort === 'asc' ? 1 : -1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .populate('user', 'username profilePicture')
          .populate('attachments')
          .populate({
            path: 'quotedMessage',
            populate: {
              path: 'user',
              select: 'username profilePicture'
            }
          });
        const messages = await messageQuery.exec();

        // Sayfalama meta bilgilerini oluştur
        const meta = createPaginationMeta(total, pagination);

        // Sayfalanmış yanıtı döndür
        return paginatedResponse(messages, meta);
      },
      60 // 60 saniye önbellek süresi
    );
  }

  /**
   * Cursor tabanlı sayfalama ile kanal mesajlarını getirir
   * @param channelId - Kanal ID
   * @param lastId - Son mesaj ID
   * @param limit - Limit
   * @param filters - Filtreleme parametreleri
   */
  async getChannelMessagesWithCursor(
    channelId: string,
    lastId?: string,
    limit = 20,
    filters: Record<string, any> = {}
  ) {
    // Temel sorgu
    const query: Record<string, any> = {
      channel: new mongoose.Types.ObjectId(channelId),
      isDeleted: filters.includeDeleted ? { $in: [true, false] } : false
    };

    // Cursor tabanlı filtreleme
    if (lastId) {
      query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
    }

    // Tarih aralığı filtresi ekle
    if (filters.startDate || filters.endDate) {
      Object.assign(query, createDateRangeFilter('timestamp', filters.startDate, filters.endDate));
    }

    // Arama filtresi ekle
    if (filters.search) {
      Object.assign(query, createSearchFilter(['content'], filters.search));
    }

    // Mesajları getir
    const messageQuery = (this.Message.find(query) as any)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('user', 'username profilePicture')
      .populate('attachments')
      .populate({
        path: 'quotedMessage',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      });
    const messages = await messageQuery.exec();

    // Daha fazla mesaj olup olmadığını kontrol et
    const hasMore = messages.length === limit;

    // Son mesaj ID'sini al
    const nextCursor = messages.length > 0 ? messages[messages.length - 1]._id : null;

    return {
      data: messages,
      meta: {
        hasMore,
        nextCursor: nextCursor ? nextCursor.toString() : null,
        limit
      }
    };
  }
}
