/**
 * src/modules/messageInteractions.ts
 * Mesaj etkileşimleri modülü (tepkiler, yanıtlar, vb.)
 */
import { Socket, Server } from 'socket.io';
import { logger } from '../utils/logger';
import { User, UserDocument } from '../models/User';
import { Message, MessageDocument } from '../models/Message';
import { performance } from '../utils/performance';
import { createModelHelper } from '../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);

// Mesaj tepkileri için tip tanımları
interface Reaction {
  emoji: string;
  userId: string;
  username: string;
  timestamp: Date;
}

interface MessageReactions {
  [messageId: string]: {
    [emoji: string]: Reaction[];
  };
}

// Modül durumu
const messageReactions: MessageReactions = {};

/**
 * Mesaja tepki ekler
 */
const addReaction = async (
  socket: Socket,
  { messageId, emoji, channelId, groupId }: { messageId: string; emoji: string; channelId: string; groupId: string }
) => {
  try {
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    if (!userId || !username) {
      socket.emit('error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      return;
    }

    // Mesajı veritabanından bul
    const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
      return await MessageHelper.findById(messageId).exec();
    });

    if (!message) {
      socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Tepki ekle
    if (!messageReactions[messageId]) {
      messageReactions[messageId] = {};
    }

    if (!messageReactions[messageId][emoji]) {
      messageReactions[messageId][emoji] = [];
    }

    // Kullanıcı zaten bu emojiyi eklemişse, tekrar ekleme
    const existingReaction = messageReactions[messageId][emoji].find(r => r.userId === userId);
    if (existingReaction) {
      socket.emit('error', { message: 'Bu tepki zaten eklenmiş', code: 'DUPLICATE' });
      return;
    }

    // Yeni tepki ekle
    const reaction: Reaction = {
      emoji,
      userId,
      username,
      timestamp: new Date()
    };

    messageReactions[messageId][emoji].push(reaction);

    // Mesajı güncelle
    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    message.reactions[emoji].push({
      userId,
      username,
      timestamp: new Date()
    });

    await message.save();

    // Tepki eklendiğini bildir
    socket.to(channelId).emit('message:reaction:added', {
      messageId,
      emoji,
      reaction,
      channelId,
      groupId
    });

    socket.emit('message:reaction:added', {
      messageId,
      emoji,
      reaction,
      channelId,
      groupId
    });

    logger.info('Mesaja tepki eklendi', {
      messageId,
      emoji,
      userId,
      username,
      channelId,
      groupId
    });
  } catch (error) {
    logger.error('Tepki ekleme hatası', { error: (error as Error).message, messageId, emoji });
    socket.emit('error', { message: 'Tepki eklenirken bir hata oluştu', code: 'SERVER_ERROR' });
  }
};

/**
 * Mesajdan tepki kaldırır
 */
const removeReaction = async (
  socket: Socket,
  { messageId, emoji, channelId, groupId }: { messageId: string; emoji: string; channelId: string; groupId: string }
) => {
  try {
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    if (!userId || !username) {
      socket.emit('error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      return;
    }

    // Mesajı veritabanından bul
    const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
      return await MessageHelper.findById(messageId).exec();
    });

    if (!message) {
      socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Tepki var mı kontrol et
    if (!messageReactions[messageId] || !messageReactions[messageId][emoji]) {
      socket.emit('error', { message: 'Tepki bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Kullanıcının tepkisini bul ve kaldır
    const reactionIndex = messageReactions[messageId][emoji].findIndex(r => r.userId === userId);
    if (reactionIndex === -1) {
      socket.emit('error', { message: 'Bu tepkiyi siz eklememişsiniz', code: 'UNAUTHORIZED' });
      return;
    }

    // Tepkiyi kaldır
    messageReactions[messageId][emoji].splice(reactionIndex, 1);

    // Eğer emoji için tepki kalmadıysa, emoji anahtarını kaldır
    if (messageReactions[messageId][emoji].length === 0) {
      delete messageReactions[messageId][emoji];
    }

    // Eğer mesaj için tepki kalmadıysa, mesaj anahtarını kaldır
    if (Object.keys(messageReactions[messageId]).length === 0) {
      delete messageReactions[messageId];
    }

    // Mesajı güncelle
    if (message.reactions && message.reactions[emoji]) {
      const msgReactionIndex = message.reactions[emoji].findIndex(r => r.userId === userId);
      if (msgReactionIndex !== -1) {
        message.reactions[emoji].splice(msgReactionIndex, 1);

        // Eğer emoji için tepki kalmadıysa, emoji anahtarını kaldır
        if (message.reactions[emoji].length === 0) {
          delete message.reactions[emoji];
        }

        // Eğer mesaj için tepki kalmadıysa, reactions alanını boş obje yap
        if (Object.keys(message.reactions).length === 0) {
          message.reactions = {};
        }

        await message.save();
      }
    }

    // Tepki kaldırıldığını bildir
    socket.to(channelId).emit('message:reaction:removed', {
      messageId,
      emoji,
      userId,
      channelId,
      groupId
    });

    socket.emit('message:reaction:removed', {
      messageId,
      emoji,
      userId,
      channelId,
      groupId
    });

    logger.info('Mesajdan tepki kaldırıldı', {
      messageId,
      emoji,
      userId,
      username,
      channelId,
      groupId
    });
  } catch (error) {
    logger.error('Tepki kaldırma hatası', { error: (error as Error).message, messageId, emoji });
    socket.emit('error', { message: 'Tepki kaldırılırken bir hata oluştu', code: 'SERVER_ERROR' });
  }
};

/**
 * Mesaja yanıt verir
 */
const replyToMessage = async (
  socket: Socket,
  {
    parentMessageId,
    content,
    channelId,
    groupId,
    mentions = []
  }: {
    parentMessageId: string;
    content: string;
    channelId: string;
    groupId: string;
    mentions?: string[];
  }
) => {
  try {
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    if (!userId || !username) {
      socket.emit('error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      return;
    }

    // Ebeveyn mesajı veritabanından bul
    const parentMessage = await performance.measureDatabaseQuery('Ebeveyn mesaj getir', async () => {
      return await MessageHelper.findById(parentMessageId).exec();
    });

    if (!parentMessage) {
      socket.emit('error', { message: 'Yanıtlanacak mesaj bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Yeni mesaj oluştur
    const newMessage = new Message({
      content,
      sender: userId,
      senderUsername: username,
      channel: channelId,
      group: groupId,
      parentMessage: parentMessageId,
      isReply: true,
      mentions
    });

    await newMessage.save();

    // Kullanıcı bilgilerini getir
    const user = await performance.measureDatabaseQuery('Kullanıcı getir', async () => {
      return await UserHelper.findById(userId).select('username avatar status').exec();
    });

    // Yanıt mesajını bildir
    const messageData = {
      ...newMessage.toObject(),
      sender: {
        _id: userId,
        username: user?.username || username,
        avatar: user?.avatar || null,
        status: user?.status || 'offline'
      },
      parentMessage: {
        _id: parentMessage._id,
        content: parentMessage.content,
        sender: parentMessage.sender,
        senderUsername: parentMessage.senderUsername
      }
    };

    socket.to(channelId).emit('message:reply', messageData);
    socket.emit('message:reply', messageData);

    logger.info('Mesaja yanıt verildi', {
      parentMessageId,
      newMessageId: newMessage._id,
      userId,
      username,
      channelId,
      groupId
    });
  } catch (error) {
    logger.error('Mesaja yanıt verme hatası', { error: (error as Error).message, parentMessageId: parentMessageId });
    socket.emit('error', { message: 'Mesaja yanıt verilirken bir hata oluştu', code: 'SERVER_ERROR' });
  }
};

/**
 * Mesajı işaretler (yıldız, bayrak, vb.)
 */
const flagMessage = async (
  socket: Socket,
  { messageId, flag, channelId, groupId }: { messageId: string; flag: string; channelId: string; groupId: string }
) => {
  try {
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    if (!userId || !username) {
      socket.emit('error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      return;
    }

    // Mesajı veritabanından bul
    const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
      return await MessageHelper.findById(messageId).exec();
    });

    if (!message) {
      socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Kullanıcı bilgilerini getir
    const user = await performance.measureDatabaseQuery('Kullanıcı getir', async () => {
      return await UserHelper.findById(userId).exec();
    });

    if (!user) {
      socket.emit('error', { message: 'Kullanıcı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    // Kullanıcının işaretlenmiş mesajlarını güncelle
    if (!user.flaggedMessages) {
      user.flaggedMessages = {};
    }

    if (!user.flaggedMessages[flag]) {
      user.flaggedMessages[flag] = [];
    }

    // Mesaj zaten işaretlenmiş mi kontrol et
    const flaggedIndex = user.flaggedMessages[flag].indexOf(messageId);

    if (flaggedIndex !== -1) {
      // Mesaj zaten işaretlenmiş, işareti kaldır
      user.flaggedMessages[flag].splice(flaggedIndex, 1);

      // Eğer bu bayrak için işaretlenmiş mesaj kalmadıysa, bayrağı kaldır
      if (user.flaggedMessages[flag].length === 0) {
        delete user.flaggedMessages[flag];
      }

      await user.save();

      socket.emit('message:flag:removed', {
        messageId,
        flag,
        channelId,
        groupId
      });

      logger.info('Mesaj işareti kaldırıldı', {
        messageId,
        flag,
        userId,
        username,
        channelId,
        groupId
      });
    } else {
      // Mesajı işaretle
      user.flaggedMessages[flag].push(messageId);
      await user.save();

      socket.emit('message:flag:added', {
        messageId,
        flag,
        channelId,
        groupId
      });

      logger.info('Mesaj işaretlendi', {
        messageId,
        flag,
        userId,
        username,
        channelId,
        groupId
      });
    }
  } catch (error) {
    logger.error('Mesaj işaretleme hatası', { error: (error as Error).message, messageId, flag });
    socket.emit('error', { message: 'Mesaj işaretlenirken bir hata oluştu', code: 'SERVER_ERROR' });
  }
};

/**
 * Mesaj etkileşimleri modülünü başlatır
 */
const initMessageInteractions = (io: Server, dependencies: any) => {
  const { richTextFormatter } = dependencies;

  io.on('connection', (socket: Socket) => {
    // Mesaj tepkileri
    socket.on('message:reaction:add', (data) => addReaction(socket, data));
    socket.on('message:reaction:remove', (data) => removeReaction(socket, data));

    // Mesaj yanıtları
    socket.on('message:reply', (data) => replyToMessage(socket, data));

    // Mesaj işaretleme
    socket.on('message:flag', (data) => flagMessage(socket, data));
  });

  logger.info('Mesaj etkileşimleri modülü başlatıldı');
};

export {
  initMessageInteractions,
  addReaction,
  removeReaction,
  replyToMessage,
  flagMessage
};
