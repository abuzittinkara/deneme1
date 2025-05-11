/**
 * src/modules/textChannel.ts
 * Metin kanalları için sunucu tarafı işlemleri
 */
import { Socket, Server } from 'socket.io';
import { logger } from '../utils/logger';
import { performance } from '../utils/performance';
import { Message, MessageDocument } from '../models/Message';
import { Channel, ChannelDocument } from '../models/Channel';
import { User, UserDocument } from '../models/User';
import { createModelHelper } from '../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

/**
 * Metin kanalı olaylarını başlatır
 */
const registerTextChannelEvents = (io: Server, dependencies: any) => {
  const { richTextFormatter } = dependencies;

  io.on('connection', (socket: Socket) => {
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    if (!userId || !username) {
      logger.warn('Kimliği doğrulanmamış bağlantı girişimi', { socketId: socket.id });
      socket.emit('error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      return;
    }

    // Kanal mesaj geçmişini getir
    socket.on(
      'channel:history',
      async ({
        channelId,
        limit = 50,
        before = null,
      }: {
        channelId: string;
        limit?: number;
        before?: string | null;
      }) => {
        try {
          // Kullanıcının bu kanala erişim yetkisi var mı kontrol et
          const channel = await performance.measureDatabaseQuery(
            'Kanal bilgilerini getir',
            async () => {
              return await ChannelHelper.findById(channelId).exec();
            }
          );

          if (!channel) {
            socket.emit('error', { message: 'Kanal bulunamadı', code: 'NOT_FOUND' });
            return;
          }

          // Sorgu oluştur
          const query: any = { channel: channelId };
          if (before) {
            query._id = { $lt: before };
          }

          // Mesajları getir
          const messages = await performance.measureDatabaseQuery(
            'Kanal mesajlarını getir',
            async () => {
              return await MessageHelper.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('sender', 'username avatar status')
                .exec();
            }
          );

          // Mesajları doğru sırada gönder (eskiden yeniye)
          socket.emit('channel:history', messages.reverse());

          logger.info('Kanal mesaj geçmişi gönderildi', {
            channelId,
            userId,
            username,
            messageCount: messages.length,
          });
        } catch (error) {
          logger.error('Kanal mesaj geçmişi getirme hatası', {
            error: (error as Error).message,
            channelId,
            userId,
          });
          socket.emit('error', {
            message: 'Mesaj geçmişi alınırken bir hata oluştu',
            code: 'SERVER_ERROR',
          });
        }
      }
    );

    // Yeni mesaj gönder
    socket.on(
      'channel:message',
      async ({
        channelId,
        content,
        mentions = [],
      }: {
        channelId: string;
        content: string;
        mentions?: string[];
      }) => {
        try {
          // Mesaj içeriğini işle (zengin metin formatı, emojiler, vb.)
          const processedContent = richTextFormatter.processMessageContent(content);

          // Yeni mesaj oluştur
          const message = new Message({
            content: processedContent,
            sender: userId,
            senderUsername: username,
            channel: channelId,
            mentions,
          });

          await message.save();

          // Kullanıcı bilgilerini getir
          const user = await performance.measureDatabaseQuery('Kullanıcı getir', async () => {
            return await UserHelper.findById(userId).select('username avatar status').exec();
          });

          // Mesajı socket üzerinden gönder
          const messageData = {
            ...message.toObject(),
            sender: {
              _id: userId,
              username: user?.username || username,
              avatar: user?.avatar || null,
              status: user?.status || 'offline',
            },
          };

          socket.to(channelId).emit('channel:message', messageData);
          socket.emit('channel:message', messageData);

          logger.info('Yeni mesaj gönderildi', {
            channelId,
            messageId: message._id,
            userId,
            username,
          });
        } catch (error) {
          logger.error('Mesaj gönderme hatası', {
            error: (error as Error).message,
            channelId,
            userId,
          });
          socket.emit('error', {
            message: 'Mesaj gönderilirken bir hata oluştu',
            code: 'SERVER_ERROR',
          });
        }
      }
    );

    // Mesaj düzenle
    socket.on(
      'channel:message:edit',
      async ({ messageId, content }: { messageId: string; content: string }) => {
        try {
          // Mesajı bul
          const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
            return await MessageHelper.findById(messageId).exec();
          });

          if (!message) {
            socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
            return;
          }

          // Mesajın sahibi mi kontrol et
          if (message.sender.toString() !== userId) {
            socket.emit('error', {
              message: 'Bu mesajı düzenleme yetkiniz yok',
              code: 'UNAUTHORIZED',
            });
            return;
          }

          // Mesaj içeriğini işle (zengin metin formatı, emojiler, vb.)
          const processedContent = richTextFormatter.processMessageContent(content);

          // Mesajı güncelle
          message.content = processedContent;
          message.isEdited = true;
          message.editedAt = new Date();
          await message.save();

          // Mesaj güncellendiğini bildir
          socket.to(message.channel.toString()).emit('channel:message:edit', {
            messageId,
            content: processedContent,
            isEdited: true,
            editedAt: message.editedAt,
          });

          socket.emit('channel:message:edit', {
            messageId,
            content: processedContent,
            isEdited: true,
            editedAt: message.editedAt,
          });

          logger.info('Mesaj düzenlendi', {
            messageId,
            channelId: message.channel,
            userId,
            username,
          });
        } catch (error) {
          logger.error('Mesaj düzenleme hatası', {
            error: (error as Error).message,
            messageId,
            userId,
          });
          socket.emit('error', {
            message: 'Mesaj düzenlenirken bir hata oluştu',
            code: 'SERVER_ERROR',
          });
        }
      }
    );

    // Mesaj sil
    socket.on('channel:message:delete', async ({ messageId }: { messageId: string }) => {
      try {
        // Mesajı bul
        const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
          return await MessageHelper.findById(messageId).exec();
        });

        if (!message) {
          socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
          return;
        }

        // Mesajın sahibi mi kontrol et
        if (message.sender.toString() !== userId) {
          socket.emit('error', { message: 'Bu mesajı silme yetkiniz yok', code: 'UNAUTHORIZED' });
          return;
        }

        // Mesajı sil
        await MessageHelper.getModel().deleteOne({ _id: message._id });

        // Mesaj silindiğini bildir
        socket.to(message.channel.toString()).emit('channel:message:delete', {
          messageId,
        });

        socket.emit('channel:message:delete', {
          messageId,
        });

        logger.info('Mesaj silindi', {
          messageId,
          channelId: message.channel,
          userId,
          username,
        });
      } catch (error) {
        logger.error('Mesaj silme hatası', {
          error: (error as Error).message,
          messageId,
          userId,
        });
        socket.emit('error', { message: 'Mesaj silinirken bir hata oluştu', code: 'SERVER_ERROR' });
      }
    });

    // Mesaj sabitle
    socket.on(
      'channel:message:pin',
      async ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
        try {
          // Mesajı bul
          const message = await performance.measureDatabaseQuery('Mesaj getir', async () => {
            return await MessageHelper.findById(messageId).exec();
          });

          if (!message) {
            socket.emit('error', { message: 'Mesaj bulunamadı', code: 'NOT_FOUND' });
            return;
          }

          // Mesajı güncelle
          message.isPinned = isPinned;
          await message.save();

          // Mesaj sabitlendiğini bildir
          socket.to(message.channel.toString()).emit('channel:message:pin', {
            messageId,
            isPinned,
          });

          socket.emit('channel:message:pin', {
            messageId,
            isPinned,
          });

          logger.info(`Mesaj ${isPinned ? 'sabitlendi' : 'sabitlemesi kaldırıldı'}`, {
            messageId,
            channelId: message.channel,
            userId,
            username,
          });
        } catch (error) {
          logger.error('Mesaj sabitleme hatası', {
            error: (error as Error).message,
            messageId,
            userId,
          });
          socket.emit('error', {
            message: 'Mesaj sabitlenirken bir hata oluştu',
            code: 'SERVER_ERROR',
          });
        }
      }
    );

    // Yazıyor... bildirimi
    socket.on(
      'channel:typing',
      ({ channelId, isTyping }: { channelId: string; isTyping: boolean }) => {
        socket.to(channelId).emit('channel:typing', {
          userId,
          username,
          isTyping,
        });
      }
    );
  });

  logger.info('Metin kanalı olayları başlatıldı');
};

export default registerTextChannelEvents;
