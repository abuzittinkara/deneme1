/**
 * src/services/messageService.ts
 * Mesaj servisi - Sayfalama, filtreleme ve önbellek optimizasyonları
 */
import mongoose from 'mongoose';
import {
  PaginationParams,
  createPaginationMeta,
  paginatedResponse,
} from '../middleware/pagination';
import { createDateRangeFilter, createSearchFilter } from '../middleware/filtering';
import cacheService from './cacheService';
import { CommonModelStaticMethods } from '../types/mongoose-types';
import logger from '../utils/logger';

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
type MessageModel = CommonModelStaticMethods<MessageDocument>;

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
   * @param options - Ek seçenekler
   */
  async getChannelMessages(
    channelId: string,
    pagination: PaginationParams,
    filters: Record<string, any> = {},
    options: {
      skipCache?: boolean;
      cacheTTL?: number;
      lean?: boolean;
      projection?: string;
    } = {}
  ) {
    // Önbellek anahtarı oluştur
    const cacheKey = `messages:channel:${channelId}:page:${pagination.page}:limit:${pagination.limit}:${this.createFilterHash(filters)}`;

    // Önbellek TTL (saniye)
    const cacheTTL = options.cacheTTL || 60; // Varsayılan 60 saniye

    // Önbelleği atla
    if (options.skipCache) {
      return await this.fetchChannelMessages(channelId, pagination, filters, options);
    }

    try {
      // Önbellekten veri getirmeyi dene
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        logger.debug('Önbellekten mesajlar alındı', { channelId, cacheKey });
        return cachedData;
      }

      // Önbellekte yoksa veritabanından getir
      const result = await this.fetchChannelMessages(channelId, pagination, filters, options);

      // Önbelleğe kaydet
      await cacheService.set(cacheKey, result, cacheTTL);

      return result;
    } catch (error) {
      logger.error('Mesajlar getirilirken hata oluştu', {
        error: (error as Error).message,
        channelId,
        pagination,
        filters,
      });

      // Hata durumunda veritabanından getir
      return await this.fetchChannelMessages(channelId, pagination, filters, options);
    }
  }

  /**
   * Veritabanından kanal mesajlarını getirir
   * @param channelId - Kanal ID
   * @param pagination - Sayfalama parametreleri
   * @param filters - Filtreleme parametreleri
   * @param options - Ek seçenekler
   */
  private async fetchChannelMessages(
    channelId: string,
    pagination: PaginationParams,
    filters: Record<string, any> = {},
    options: {
      lean?: boolean;
      projection?: string;
    } = {}
  ) {
    const startTime = Date.now();

    try {
      // Temel sorgu
      const query: Record<string, any> = {
        channel: new mongoose.Types.ObjectId(channelId),
        isDeleted: filters['includeDeleted'] ? { $in: [true, false] } : false,
      };

      // Tarih aralığı filtresi ekle
      if (filters['startDate'] || filters['endDate']) {
        Object.assign(
          query,
          createDateRangeFilter('timestamp', filters['startDate'], filters['endDate'])
        );
      }

      // Arama filtresi ekle
      if (filters['search']) {
        Object.assign(query, createSearchFilter(['content'], filters['search']));
      }

      // Kullanıcı filtresi ekle
      if (filters['userId']) {
        query['user'] = new mongoose.Types.ObjectId(filters['userId']);
      }

      // Sabitlenen mesajlar filtresi
      if (filters['pinned'] === 'true' || filters['pinned'] === true) {
        query['isPinned'] = true;
      }

      // Toplam mesaj sayısını getir (önbellekle)
      const countCacheKey = `messages:count:channel:${channelId}:${this.createFilterHash(filters)}`;
      let total = await cacheService.get<number>(countCacheKey);

      if (total === null) {
        total = await this.Message.countDocuments(query);
        await cacheService.set(countCacheKey, total, 300); // 5 dakika önbellek
      }

      // Mesajları getir
      let messageQuery = this.Message.find(query);

      // Sıralama
      messageQuery = messageQuery.sort({ timestamp: filters['sort'] === 'asc' ? 1 : -1 });

      // Sayfalama
      messageQuery = messageQuery.skip(pagination.skip).limit(pagination.limit);

      // Projeksiyon (sadece belirli alanları getir)
      if (options.projection) {
        messageQuery = messageQuery.select(options.projection);
      } else {
        // Varsayılan projeksiyon - gereksiz alanları hariç tut
        messageQuery = messageQuery.select('-__v');
      }

      // İlişkili verileri getir
      messageQuery = messageQuery.populate('user', 'username profilePicture status');

      // Ek ilişkili veriler (isteğe bağlı)
      if (filters['includeAttachments']) {
        messageQuery = messageQuery.populate('attachments');
      }

      if (filters['includeQuotedMessages']) {
        messageQuery = messageQuery.populate({
          path: 'quotedMessage',
          select: 'content user timestamp',
          populate: {
            path: 'user',
            select: 'username profilePicture',
          },
        });
      }

      // Performans için lean kullan (varsayılan olarak kullan)
      if (options.lean !== false) {
        messageQuery = messageQuery.lean();
      }

      // Sorguyu çalıştır
      const messages = await messageQuery.exec();

      // Sayfalama meta bilgilerini oluştur
      const meta = createPaginationMeta(total, pagination);

      // Performans metriklerini kaydet
      const duration = Date.now() - startTime;
      logger.debug('Mesajlar veritabanından alındı', {
        channelId,
        count: messages.length,
        duration: `${duration}ms`,
        filters: Object.keys(filters),
      });

      // Sayfalanmış yanıtı döndür
      return paginatedResponse(messages, meta);
    } catch (error) {
      logger.error('Veritabanından mesajlar getirilirken hata oluştu', {
        error: (error as Error).message,
        channelId,
        duration: `${Date.now() - startTime}ms`,
      });
      throw error;
    }
  }

  /**
   * Filtrelerden hash oluşturur (önbellek anahtarı için)
   * @param filters - Filtreleme parametreleri
   */
  private createFilterHash(filters: Record<string, any>): string {
    // Önemli filtreleri seç
    const relevantFilters = {
      includeDeleted: filters.includeDeleted,
      search: filters.search,
      userId: filters.userId,
      pinned: filters.pinned,
      sort: filters.sort,
      startDate: filters.startDate,
      endDate: filters.endDate,
      includeAttachments: filters.includeAttachments,
      includeQuotedMessages: filters.includeQuotedMessages,
    };

    // Undefined değerleri temizle
    Object.keys(relevantFilters).forEach((key) => {
      if (relevantFilters[key] === undefined) {
        delete relevantFilters[key];
      }
    });

    // Hash oluştur
    return Object.keys(relevantFilters).length > 0
      ? `filters:${JSON.stringify(relevantFilters)}`
      : 'no-filters';
  }

  /**
   * Cursor tabanlı sayfalama ile kanal mesajlarını getirir
   * @param channelId - Kanal ID
   * @param lastId - Son mesaj ID
   * @param limit - Limit
   * @param filters - Filtreleme parametreleri
   * @param options - Ek seçenekler
   */
  async getChannelMessagesWithCursor(
    channelId: string,
    lastId?: string,
    limit = 20,
    filters: Record<string, any> = {},
    options: {
      skipCache?: boolean;
      cacheTTL?: number;
      lean?: boolean;
      projection?: string;
    } = {}
  ) {
    // Önbellek anahtarı oluştur
    const cacheKey = `messages:cursor:channel:${channelId}:lastId:${lastId || 'start'}:limit:${limit}:${this.createFilterHash(filters)}`;

    // Önbellek TTL (saniye)
    const cacheTTL = options.cacheTTL || 60; // Varsayılan 60 saniye

    // Önbelleği atla
    if (options.skipCache) {
      return await this.fetchChannelMessagesWithCursor(channelId, lastId, limit, filters, options);
    }

    try {
      // Önbellekten veri getirmeyi dene
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        logger.debug('Önbellekten cursor mesajları alındı', { channelId, cacheKey });
        return cachedData;
      }

      // Önbellekte yoksa veritabanından getir
      const result = await this.fetchChannelMessagesWithCursor(
        channelId,
        lastId,
        limit,
        filters,
        options
      );

      // Önbelleğe kaydet
      await cacheService.set(cacheKey, result, cacheTTL);

      return result;
    } catch (error) {
      logger.error('Cursor mesajları getirilirken hata oluştu', {
        error: (error as Error).message,
        channelId,
        lastId,
        limit,
        filters,
      });

      // Hata durumunda veritabanından getir
      return await this.fetchChannelMessagesWithCursor(channelId, lastId, limit, filters, options);
    }
  }

  /**
   * Veritabanından cursor tabanlı kanal mesajlarını getirir
   * @param channelId - Kanal ID
   * @param lastId - Son mesaj ID
   * @param limit - Limit
   * @param filters - Filtreleme parametreleri
   * @param options - Ek seçenekler
   */
  private async fetchChannelMessagesWithCursor(
    channelId: string,
    lastId?: string,
    limit = 20,
    filters: Record<string, any> = {},
    options: {
      lean?: boolean;
      projection?: string;
    } = {}
  ) {
    const startTime = Date.now();

    try {
      // Temel sorgu
      const query: Record<string, any> = {
        channel: new mongoose.Types.ObjectId(channelId),
        isDeleted: filters['includeDeleted'] ? { $in: [true, false] } : false,
      };

      // Cursor tabanlı filtreleme
      if (lastId) {
        query['_id'] = { $lt: new mongoose.Types.ObjectId(lastId) };
      }

      // Tarih aralığı filtresi ekle
      if (filters['startDate'] || filters['endDate']) {
        Object.assign(
          query,
          createDateRangeFilter('timestamp', filters['startDate'], filters['endDate'])
        );
      }

      // Arama filtresi ekle
      if (filters['search']) {
        Object.assign(query, createSearchFilter(['content'], filters['search']));
      }

      // Kullanıcı filtresi ekle
      if (filters['userId']) {
        query['user'] = new mongoose.Types.ObjectId(filters['userId']);
      }

      // Mesajları getir
      let messageQuery = this.Message.find(query);

      // Sıralama - cursor tabanlı sayfalama için _id kullan
      messageQuery = messageQuery.sort({ _id: -1 });

      // Limit
      messageQuery = messageQuery.limit(limit + 1); // Bir fazla getir (hasMore kontrolü için)

      // Projeksiyon (sadece belirli alanları getir)
      if (options.projection) {
        messageQuery = messageQuery.select(options.projection);
      } else {
        // Varsayılan projeksiyon - gereksiz alanları hariç tut
        messageQuery = messageQuery.select('-__v');
      }

      // İlişkili verileri getir
      messageQuery = messageQuery.populate('user', 'username profilePicture status');

      // Ek ilişkili veriler (isteğe bağlı)
      if (filters['includeAttachments']) {
        messageQuery = messageQuery.populate('attachments');
      }

      if (filters['includeQuotedMessages']) {
        messageQuery = messageQuery.populate({
          path: 'quotedMessage',
          select: 'content user timestamp',
          populate: {
            path: 'user',
            select: 'username profilePicture',
          },
        });
      }

      // Performans için lean kullan (varsayılan olarak kullan)
      if (options.lean !== false) {
        messageQuery = messageQuery.lean();
      }

      // Sorguyu çalıştır
      const messages = await messageQuery.exec();

      // Daha fazla mesaj olup olmadığını kontrol et
      const hasMore = messages.length > limit;

      // Fazla mesajı kaldır
      if (hasMore) {
        messages.pop();
      }

      // Son mesaj ID'sini al
      const nextCursor = messages.length > 0 ? messages[messages.length - 1]._id : null;

      // Performans metriklerini kaydet
      const duration = Date.now() - startTime;
      logger.debug('Cursor mesajları veritabanından alındı', {
        channelId,
        count: messages.length,
        duration: `${duration}ms`,
        hasMore,
        filters: Object.keys(filters),
      });

      return {
        data: messages,
        meta: {
          hasMore,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          limit,
        },
      };
    } catch (error) {
      logger.error('Veritabanından cursor mesajları getirilirken hata oluştu', {
        error: (error as Error).message,
        channelId,
        lastId,
        duration: `${Date.now() - startTime}ms`,
      });
      throw error;
    }
  }
}
