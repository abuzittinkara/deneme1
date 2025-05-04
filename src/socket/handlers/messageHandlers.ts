/**
 * src/socket/handlers/messageHandlers.ts
 * Mesaj olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';

/**
 * Mesaj olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerMessageHandlers(
  socket: TypedSocket,
  dependencies: any
): void {
  const { messageManager, richTextFormatter, notificationManager } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Mesaj gönderme olayı
   */
  socket.on('message:send', async (data) => {
    const { content, channelId, type = 'text', attachments = [] } = data;

    try {
      // Mesaj içeriğini işle (zengin metin, emoji, bahsetmeler vb.)
      const processedContent = await richTextFormatter.processContent(content);

      // Mesajı veritabanına kaydet
      const message = await measurePerformanceAsync(
        async () => {
          return await messageManager.createMessage({
            content: processedContent,
            channelId,
            senderId: userId,
            type,
            attachments
          });
        },
        'Mesaj oluşturma'
      );

      // Mesajı kanaldaki diğer kullanıcılara gönder
      socket.to(channelId).emit('message:new', { message });

      // Bahsedilen kullanıcılara bildirim gönder
      if (message.mentions && message.mentions.length > 0) {
        for (const mentionedUser of message.mentions) {
          notificationManager.createMentionNotification(
            mentionedUser.toString(),
            userId,
            channelId,
            message._id.toString()
          );
        }
      }

      logger.debug('Mesaj gönderildi', {
        userId,
        username,
        channelId,
        messageId: message._id.toString()
      });
    } catch (error) {
      logger.error('Mesaj gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId
      });

      socket.emit('error', {
        message: 'Mesaj gönderilemedi',
        code: 'MESSAGE_SEND_ERROR'
      });
    }
  });

  /**
   * Mesaj düzenleme olayı
   */
  socket.on('message:edit', async (data) => {
    const { messageId, content } = data;

    try {
      // Mesaj içeriğini işle
      const processedContent = await richTextFormatter.processContent(content);

      // Mesajı güncelle
      const updatedMessage = await measurePerformanceAsync(
        async () => {
          return await messageManager.updateMessage(messageId, userId, processedContent);
        },
        'Mesaj güncelleme'
      );

      if (!updatedMessage) {
        throw new Error('Mesaj güncellenemedi');
      }

      // Mesajın bulunduğu kanala güncelleme bilgisini gönder
      socket.to(updatedMessage.channel.toString()).emit('message:update', {
        messageId,
        content: processedContent,
        updatedAt: updatedMessage.updatedAt.toISOString()
      });

      logger.debug('Mesaj güncellendi', {
        userId,
        username,
        messageId
      });
    } catch (error) {
      logger.error('Mesaj güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId
      });

      socket.emit('error', {
        message: 'Mesaj güncellenemedi',
        code: 'MESSAGE_UPDATE_ERROR'
      });
    }
  });

  /**
   * Mesaj silme olayı
   */
  socket.on('message:delete', async (data) => {
    const { messageId } = data;

    try {
      // Mesajı sil
      const deletedMessage = await measurePerformanceAsync(
        async () => {
          return await messageManager.deleteMessage(messageId, userId);
        },
        'Mesaj silme'
      );

      if (!deletedMessage) {
        throw new Error('Mesaj silinemedi');
      }

      // Mesajın bulunduğu kanala silme bilgisini gönder
      socket.to(deletedMessage.channel.toString()).emit('message:delete', {
        messageId,
        channelId: deletedMessage.channel.toString()
      });

      logger.debug('Mesaj silindi', {
        userId,
        username,
        messageId
      });
    } catch (error) {
      logger.error('Mesaj silme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId
      });

      socket.emit('error', {
        message: 'Mesaj silinemedi',
        code: 'MESSAGE_DELETE_ERROR'
      });
    }
  });

  /**
   * Mesaj okundu olayı
   */
  socket.on('message:read', async (data) => {
    const { messageId, channelId } = data;

    try {
      // Mesajı okundu olarak işaretle
      await measurePerformanceAsync(
        async () => {
          await messageManager.markMessageAsRead(messageId, userId);
        },
        'Mesaj okundu işaretleme'
      );

      // Kanaldaki diğer kullanıcılara okundu bilgisini gönder
      socket.to(channelId).emit('message:read', {
        messageId,
        userId,
        username
      });

      logger.debug('Mesaj okundu işaretlendi', {
        userId,
        username,
        messageId
      });
    } catch (error) {
      logger.error('Mesaj okundu işaretleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId
      });
    }
  });

  /**
   * Mesaj tepki olayı
   */
  socket.on('message:reaction', async (data) => {
    const { messageId, emoji } = data;

    try {
      // Mesaja tepki ekle
      const reaction = await measurePerformanceAsync(
        async () => {
          return await messageManager.addReaction(messageId, userId, emoji);
        },
        'Mesaj tepki ekleme'
      );

      if (!reaction) {
        throw new Error('Tepki eklenemedi');
      }

      // Mesajın bulunduğu kanala tepki bilgisini gönder
      const message = await messageManager.getMessage(messageId);

      if (message) {
        socket.to(message.channel.toString()).emit('message:reaction', {
          messageId,
          userId,
          username,
          emoji
        });
      }

      logger.debug('Mesaja tepki eklendi', {
        userId,
        username,
        messageId,
        emoji
      });
    } catch (error) {
      logger.error('Mesaj tepki ekleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
        emoji
      });

      socket.emit('error', {
        message: 'Tepki eklenemedi',
        code: 'REACTION_ADD_ERROR'
      });
    }
  });
}
