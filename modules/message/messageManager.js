/**************************************
 * modules/message/messageManager.js
 * Mesaj yönetimi işlemleri
 **************************************/
const Message = require('../../models/Message');
const Channel = require('../../models/Channel');
const User = require('../../models/User');
const { messageCache } = require('../../utils/cacheManager');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * Kanal mesajı gönderir
 * @param {string} channelId - Kanal ID'si
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} content - Mesaj içeriği
 * @param {Array} [attachments] - Dosya ekleri
 * @returns {Promise<Object>} - Gönderilen mesaj
 */
async function sendChannelMessage(channelId, userId, content, attachments = []) {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }
    
    // Kullanıcıyı bul
    const user = await User.findById(userId);
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
      reactions: new Map()
    });
    
    // Mesajı kaydet
    const savedMessage = await message.save();
    
    // Mesajı kullanıcı bilgileriyle birlikte getir
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('user', 'username name surname profilePicture')
      .exec();
    
    // Önbelleğe ekle
    messageCache.set(`message:${savedMessage._id}`, populatedMessage);
    
    logger.info('Mesaj gönderildi', { channelId, userId, messageId: savedMessage._id });
    
    return populatedMessage;
  } catch (error) {
    logger.error('Mesaj gönderme hatası', { error: error.message, channelId, userId });
    throw error;
  }
}

/**
 * Kanal mesajını düzenler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} newContent - Yeni mesaj içeriği
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Düzenlenen mesaj
 */
async function editChannelMessage(messageId, newContent, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
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
      messageId: message._id,
      channelId: message.channel,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt
    };
  } catch (error) {
    logger.error('Mesaj düzenleme hatası', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Kanal mesajını siler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Silinen mesaj
 */
async function deleteChannelMessage(messageId, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
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
      messageId: message._id,
      channelId: message.channel,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt
    };
  } catch (error) {
    logger.error('Mesaj silme hatası', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Kanal mesajlarını getirir
 * @param {string} channelId - Kanal ID'si
 * @param {Object} options - Seçenekler
 * @param {number} [options.limit=50] - Limit
 * @param {number} [options.skip=0] - Atlama
 * @returns {Promise<Array>} - Mesaj listesi
 */
async function getChannelMessages(channelId, options = {}) {
  try {
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    
    // Önbellekten kontrol et
    const cacheKey = `channel:${channelId}:messages:${limit}:${skip}`;
    const cachedMessages = messageCache.get(cacheKey);
    
    if (cachedMessages) {
      logger.debug('Mesajlar önbellekten getirildi', { channelId, limit, skip });
      return cachedMessages;
    }
    
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }
    
    // Mesajları getir
    const messages = await Message.find({ channel: channelId, isDeleted: false })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username name surname profilePicture')
      .exec();
    
    // Önbelleğe ekle
    messageCache.set(cacheKey, messages, 60000); // 1 dakika TTL
    
    logger.info('Mesajlar getirildi', { channelId, count: messages.length });
    
    return messages;
  } catch (error) {
    logger.error('Mesaj getirme hatası', { error: error.message, channelId });
    throw error;
  }
}

/**
 * Mesaj tepkisi ekler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Tepki sonucu
 */
async function addReaction(messageId, emoji, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }
    
    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    
    // Tepki ekle
    if (!message.reactions) {
      message.reactions = new Map();
    }
    
    if (!message.reactions.has(emoji)) {
      message.reactions.set(emoji, []);
    }
    
    const userReactions = message.reactions.get(emoji);
    
    // Kullanıcı zaten tepki vermiş mi kontrol et
    if (!userReactions.includes(userId)) {
      userReactions.push(userId);
      message.reactions.set(emoji, userReactions);
      
      // Mesajı kaydet
      await message.save();
      
      // Önbellekten sil
      messageCache.delete(`message:${messageId}`);
      
      logger.info('Mesaj tepkisi eklendi', { messageId, emoji, userId });
    }
    
    return {
      messageId: message._id,
      emoji,
      userId,
      count: userReactions.length
    };
  } catch (error) {
    logger.error('Tepki ekleme hatası', { error: error.message, messageId, emoji, userId });
    throw error;
  }
}

/**
 * Mesaj tepkisini kaldırır
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Tepki sonucu
 */
async function removeReaction(messageId, emoji, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }
    
    // Tepki var mı kontrol et
    if (!message.reactions || !message.reactions.has(emoji)) {
      return {
        messageId: message._id,
        emoji,
        userId,
        count: 0
      };
    }
    
    // Tepkiyi kaldır
    let userReactions = message.reactions.get(emoji);
    userReactions = userReactions.filter(id => id.toString() !== userId.toString());
    
    if (userReactions.length === 0) {
      message.reactions.delete(emoji);
    } else {
      message.reactions.set(emoji, userReactions);
    }
    
    // Mesajı kaydet
    await message.save();
    
    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);
    
    logger.info('Mesaj tepkisi kaldırıldı', { messageId, emoji, userId });
    
    return {
      messageId: message._id,
      emoji,
      userId,
      count: userReactions.length
    };
  } catch (error) {
    logger.error('Tepki kaldırma hatası', { error: error.message, messageId, emoji, userId });
    throw error;
  }
}

/**
 * Mesajı sabitler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Sabitlenen mesaj
 */
async function pinMessage(messageId, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }
    
    // Mesajı sabitle
    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = userId;
    
    // Mesajı kaydet
    await message.save();
    
    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);
    
    logger.info('Mesaj sabitlendi', { messageId, userId });
    
    return {
      messageId: message._id,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt,
      pinnedBy: message.pinnedBy
    };
  } catch (error) {
    logger.error('Mesaj sabitleme hatası', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Mesaj sabitlemesini kaldırır
 * @param {string} messageId - Mesaj ID'si
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Sabitleme kaldırılan mesaj
 */
async function unpinMessage(messageId, userId) {
  try {
    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mesaj bulunamadı');
    }
    
    // Mesaj sabitlenmiş mi kontrol et
    if (!message.isPinned) {
      return {
        messageId: message._id,
        isPinned: false
      };
    }
    
    // Mesaj sabitlemesini kaldır
    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedBy = null;
    
    // Mesajı kaydet
    await message.save();
    
    // Önbellekten sil
    messageCache.delete(`message:${messageId}`);
    
    logger.info('Mesaj sabitlemesi kaldırıldı', { messageId, userId });
    
    return {
      messageId: message._id,
      isPinned: message.isPinned
    };
  } catch (error) {
    logger.error('Mesaj sabitlemesi kaldırma hatası', { error: error.message, messageId, userId });
    throw error;
  }
}

/**
 * Sabitlenmiş mesajları getirir
 * @param {string} channelId - Kanal ID'si
 * @returns {Promise<Array>} - Sabitlenmiş mesaj listesi
 */
async function getPinnedMessages(channelId) {
  try {
    // Önbellekten kontrol et
    const cacheKey = `channel:${channelId}:pinnedMessages`;
    const cachedMessages = messageCache.get(cacheKey);
    
    if (cachedMessages) {
      logger.debug('Sabitlenmiş mesajlar önbellekten getirildi', { channelId });
      return cachedMessages;
    }
    
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }
    
    // Sabitlenmiş mesajları getir
    const messages = await Message.find({ channel: channelId, isPinned: true, isDeleted: false })
      .sort({ pinnedAt: -1 })
      .populate('user', 'username name surname profilePicture')
      .populate('pinnedBy', 'username')
      .exec();
    
    // Önbelleğe ekle
    messageCache.set(cacheKey, messages, 300000); // 5 dakika TTL
    
    logger.info('Sabitlenmiş mesajlar getirildi', { channelId, count: messages.length });
    
    return messages;
  } catch (error) {
    logger.error('Sabitlenmiş mesaj getirme hatası', { error: error.message, channelId });
    throw error;
  }
}

module.exports = {
  sendChannelMessage,
  editChannelMessage,
  deleteChannelMessage,
  getChannelMessages,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  getPinnedMessages
};
