/**
 * src/modules/message/messageManager.ts
 * Mesaj yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Message, MessageDocument } from '../../models/Message';
import { Channel, ChannelDocument } from '../../models/Channel';
import { User, UserDocument } from '../../models/User';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { messageCache } from '../../utils/cacheManager';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { toObjectId } from '../../utils/mongoose-helpers';

// Model yardımcıları
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Mesaj seçenekleri arayüzü
export interface MessageOptions {
  limit?: number;
  skip?: number;
}

// Mesaj sonucu arayüzü
export interface MessageResult {
  messageId: mongoose.Types.ObjectId;
  channelId?: mongoose.Types.ObjectId;
  content?: string;
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  isPinned?: boolean;
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
}

// Tepki sonucu arayüzü
export interface ReactionResult {
  messageId: mongoose.Types.ObjectId;
  emoji: string;
  userId: mongoose.Types.ObjectId;
  count: number;
}

/**
 * Kanal mesajı gönderir
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @param content - Mesaj içeriği
 * @param attachments - Dosya ekleri
 * @returns Gönderilen mesaj
 */
export async function sendChannelMessage(
  channelId: string,
  userId: string,
  content: string,
  attachments: mongoose.Types.ObjectId[] = []
): Promise<MessageDocument> {
  try {
    // Kanalı bul
    const channel = await ChannelHelper.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcıyı bul
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Mesajı oluştur
    const message = new Message({
      channel: channelId,
      user: userId,
      content,
      timestamp: new Date(),
      attachments,
      isEdited: false,
      isDeleted: false,
      reactions: {},
    });

    // Mesajı kaydet
    const savedMessage = await message.save();

    // Mesajı kullanıcı bilgileriyle birlikte getir
    const populatedMessage = await MessageHelper.findById(savedMessage._id.toString(), null, {
      populate: { path: 'user', select: 'username name surname profilePicture' },
    });

    if (!populatedMessage) {
      throw new Error('Mesaj kaydedildi ancak getirilemedi');
    }

    // Önbelleğe ekle
    messageCache.set(`message:${savedMessage._id}`, populatedMessage);

    logger.info('Mesaj gönderildi', { channelId, userId, messageId: savedMessage._id });

    return populatedMessage;
  } catch (error) {
    logger.error('Mesaj gönderme hatası', { error: (error as Error).message, channelId, userId });
    throw error;
  }
}

/**
 * Kanal mesajını düzenler
 * @param messageId - Mesaj ID'si
 * @param newContent - Yeni mesaj içeriği
 * @param userId - Kullanıcı ID'si
 * @returns Düzenlenen mesaj
 */
export async function editChannelMessage(
  messageId: string,
  newContent: string,
  userId: string
): Promise<MessageResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Mesaj sahibi kontrolü
    if (message.user.toString() !== userId.toString()) {
      throw new ForbiddenError('Bu mesajı düzenleme yetkiniz yok');
    }

    // Mesajı düzenle
    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();
    message.originalContent = message.originalContent || message.content;

    // Mesajı kaydet
    await message.save();

    // Önbellekten sil (güncel olmayan veriyi önlemek için)
    messageCache.delete(`message:${messageId}`);

    logger.info('Mesaj düzenlendi', { messageId, userId });

    return {
      messageId: toObjectId(message._id),
      channelId: message.channel,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
    };
  } catch (error) {
    logger.error('Mesaj düzenleme hatası', { error: (error as Error).message, messageId, userId });
    throw error;
  }
}

/**
 * Kanal mesajını siler
 * @param messageId - Mesaj ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Silinen mesaj
 */
export async function deleteChannelMessage(
  messageId: string,
  userId: string
): Promise<MessageResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Mesaj sahibi kontrolü
    if (message.user.toString() !== userId.toString()) {
      throw new ForbiddenError('Bu mesajı silme yetkiniz yok');
    }

    // Mesajı sil (soft delete)
    message.isDeleted = true;
    message.deletedAt = new Date();

    // Mesajı kaydet
    await message.save();

    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);

    logger.info('Mesaj silindi', { messageId, userId });

    return {
      messageId: toObjectId(message._id),
      channelId: message.channel,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
    };
  } catch (error) {
    logger.error('Mesaj silme hatası', { error: (error as Error).message, messageId, userId });
    throw error;
  }
}

/**
 * Kanal mesajlarını getirir
 * @param channelId - Kanal ID'si
 * @param options - Seçenekler
 * @returns Mesaj listesi
 */
export async function getChannelMessages(
  channelId: string,
  options: MessageOptions = {}
): Promise<MessageDocument[]> {
  try {
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    // Önbellekten kontrol et
    const cacheKey = `channel:${channelId}:messages:${limit}:${skip}`;
    const cachedMessages = messageCache.get(cacheKey) as MessageDocument[] | null;

    if (cachedMessages) {
      logger.debug('Mesajlar önbellekten getirildi', { channelId, limit, skip });
      return cachedMessages;
    }

    // Kanalı bul
    const channel = await ChannelHelper.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Mesajları getir
    const messages = await MessageHelper.find({ channel: channelId, isDeleted: false }, null, {
      sort: { timestamp: -1 },
      skip,
      limit,
      populate: { path: 'user', select: 'username name surname profilePicture' },
    });

    // Önbelleğe ekle
    messageCache.set(cacheKey, messages, 60000); // 1 dakika TTL

    logger.info('Mesajlar getirildi', { channelId, count: messages.length });

    return messages;
  } catch (error) {
    logger.error('Mesaj getirme hatası', { error: (error as Error).message, channelId });
    throw error;
  }
}

/**
 * Mesaj tepkisi ekler
 * @param messageId - Mesaj ID'si
 * @param emoji - Emoji
 * @param userId - Kullanıcı ID'si
 * @returns Tepki sonucu
 */
export async function addReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<ReactionResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Kullanıcıyı bul
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Tepki ekle
    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    const userReactions = message.reactions[emoji] || [];

    // Kullanıcı zaten tepki vermiş mi kontrol et
    if (!userReactions.some((id) => id.toString() === userId.toString())) {
      userReactions.push({
        userId,
        username: user.username,
        timestamp: new Date(),
      });
      message.reactions[emoji] = userReactions;

      // Mesajı kaydet
      await message.save();

      // Önbellekten sil
      messageCache.delete(`message:${messageId}`);

      logger.info('Mesaj tepkisi eklendi', { messageId, emoji, userId });
    }

    return {
      messageId: toObjectId(message._id),
      emoji,
      userId: new mongoose.Types.ObjectId(userId),
      count: userReactions.length,
    };
  } catch (error) {
    logger.error('Tepki ekleme hatası', {
      error: (error as Error).message,
      messageId,
      emoji,
      userId,
    });
    throw error;
  }
}

/**
 * Mesaj tepkisini kaldırır
 * @param messageId - Mesaj ID'si
 * @param emoji - Emoji
 * @param userId - Kullanıcı ID'si
 * @returns Tepki sonucu
 */
export async function removeReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<ReactionResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Tepki var mı kontrol et
    if (!message.reactions || !message.reactions[emoji]) {
      return {
        messageId: toObjectId(message._id),
        emoji,
        userId: new mongoose.Types.ObjectId(userId),
        count: 0,
      };
    }

    // Tepkiyi kaldır
    let userReactions = message.reactions[emoji] || [];
    userReactions = userReactions.filter((reaction) => reaction.userId !== userId);

    if (userReactions.length === 0) {
      delete message.reactions[emoji];
    } else {
      message.reactions[emoji] = userReactions;
    }

    // Mesajı kaydet
    await message.save();

    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);

    logger.info('Mesaj tepkisi kaldırıldı', { messageId, emoji, userId });

    return {
      messageId: toObjectId(message._id),
      emoji,
      userId: new mongoose.Types.ObjectId(userId),
      count: userReactions.length,
    };
  } catch (error) {
    logger.error('Tepki kaldırma hatası', {
      error: (error as Error).message,
      messageId,
      emoji,
      userId,
    });
    throw error;
  }
}

/**
 * Mesajı sabitler
 * @param messageId - Mesaj ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Sabitlenen mesaj
 */
export async function pinMessage(messageId: string, userId: string): Promise<MessageResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Mesajı sabitle
    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = new mongoose.Types.ObjectId(userId);

    // Mesajı kaydet
    await message.save();

    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);

    logger.info('Mesaj sabitlendi', { messageId, userId });

    return {
      messageId: toObjectId(message._id),
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt,
      pinnedBy: message.pinnedBy,
    };
  } catch (error) {
    logger.error('Mesaj sabitleme hatası', { error: (error as Error).message, messageId, userId });
    throw error;
  }
}

/**
 * Mesaj sabitlemesini kaldırır
 * @param messageId - Mesaj ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Sabitleme kaldırılan mesaj
 */
export async function unpinMessage(messageId: string, userId: string): Promise<MessageResult> {
  try {
    // Mesajı bul
    const message = await MessageHelper.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }

    // Mesaj sabitlenmiş mi kontrol et
    if (!message.isPinned) {
      return {
        messageId: toObjectId(message._id),
        isPinned: false,
      };
    }

    // Mesaj sabitlemesini kaldır
    message.isPinned = false;
    message.pinnedAt = undefined;
    message.pinnedBy = undefined;

    // Mesajı kaydet
    await message.save();

    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);

    logger.info('Mesaj sabitlemesi kaldırıldı', { messageId, userId });

    return {
      messageId: toObjectId(message._id),
      isPinned: message.isPinned,
    };
  } catch (error) {
    logger.error('Mesaj sabitlemesi kaldırma hatası', {
      error: (error as Error).message,
      messageId,
      userId,
    });
    throw error;
  }
}

/**
 * Sabitlenmiş mesajları getirir
 * @param channelId - Kanal ID'si
 * @returns Sabitlenmiş mesaj listesi
 */
export async function getPinnedMessages(channelId: string): Promise<MessageDocument[]> {
  try {
    // Önbellekten kontrol et
    const cacheKey = `channel:${channelId}:pinnedMessages`;
    const cachedMessages = messageCache.get(cacheKey) as MessageDocument[] | null;

    if (cachedMessages) {
      logger.debug('Sabitlenmiş mesajlar önbellekten getirildi', { channelId });
      return cachedMessages;
    }

    // Kanalı bul
    const channel = await ChannelHelper.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Sabitlenmiş mesajları getir
    const messages = await MessageHelper.find(
      { channel: channelId, isPinned: true, isDeleted: false },
      null,
      {
        sort: { pinnedAt: -1 },
        populate: [
          { path: 'user', select: 'username name surname profilePicture' },
          { path: 'pinnedBy', select: 'username' },
        ],
      }
    );

    // Önbelleğe ekle
    messageCache.set(cacheKey, messages, 300000); // 5 dakika TTL

    logger.info('Sabitlenmiş mesajlar getirildi', { channelId, count: messages.length });

    return messages;
  } catch (error) {
    logger.error('Sabitlenmiş mesaj getirme hatası', {
      error: (error as Error).message,
      channelId,
    });
    throw error;
  }
}

export default {
  sendChannelMessage,
  editChannelMessage,
  deleteChannelMessage,
  getChannelMessages,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
};
