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
  dependencies: Record<string, any>
): void {
  const { messageManager, richTextFormatter, notificationManager, messageService } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Mesaj gönderme olayı
   */
  socket.on('message:send', async (data) => {
    const { content, channelId, quotedMessageId, mentions = [], attachments = [] } = data;

    try {
      // Mesaj içeriğini işle (zengin metin, emoji, bahsetmeler vb.)
      let processedContent = content;
      if (richTextFormatter && typeof richTextFormatter.processContent === 'function') {
        processedContent = await richTextFormatter.processContent(content);
      }

      // Mesajı veritabanına kaydet
      let message;

      if (messageService) {
        // Yeni servis kullan
        message = await measurePerformanceAsync(async () => {
          return await messageService.createMessage({
            channelId,
            userId,
            content: processedContent,
            quotedMessageId,
            mentions,
            attachments,
          });
        }, 'Mesaj oluşturma (yeni servis)');
      } else if (messageManager) {
        // Eski modülü kullan
        message = await measurePerformanceAsync(async () => {
          return await messageManager.createMessage({
            content: processedContent,
            channelId,
            senderId: userId,
            type: 'text',
            attachments,
          });
        }, 'Mesaj oluşturma (eski modül)');
      } else {
        throw new Error('Mesaj servisi bulunamadı');
      }

      // Mesajı kanaldaki diğer kullanıcılara gönder
      socket.to(channelId).emit('message:new', {
        message: {
          id: message._id || message.id,
          channelId,
          content: processedContent,
          sender: {
            id: userId,
            username,
          },
          attachments,
          createdAt: message.createdAt || message.timestamp || new Date().toISOString(),
          quotedMessageId,
          mentions,
        },
      });

      // Yazıyor... durumunu temizle
      socket.to(channelId).emit('user:typing', {
        channelId,
        userId,
        isTyping: false,
      });

      // Bahsedilen kullanıcılara bildirim gönder
      if (mentions && mentions.length > 0 && notificationManager) {
        for (const mentionedUser of mentions) {
          notificationManager.createMentionNotification(
            mentionedUser.toString(),
            userId,
            channelId,
            message._id ? message._id.toString() : message.id
          );
        }
      }

      logger.debug('Mesaj gönderildi', {
        userId,
        username,
        channelId,
        messageId: message._id ? message._id.toString() : message.id,
      });
    } catch (error) {
      logger.error('Mesaj gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId,
      });

      socket.emit('error', {
        message: 'Mesaj gönderilemedi',
        code: 'MESSAGE_SEND_ERROR',
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
      let processedContent = content;
      if (richTextFormatter && typeof richTextFormatter.processContent === 'function') {
        processedContent = await richTextFormatter.processContent(content);
      }

      // Mesajı güncelle
      let updatedMessage;

      if (messageService) {
        // Yeni servis kullan
        updatedMessage = await measurePerformanceAsync(async () => {
          return await messageService.updateMessage(
            messageId,
            { content: processedContent },
            userId
          );
        }, 'Mesaj güncelleme (yeni servis)');
      } else if (messageManager) {
        // Eski modülü kullan
        updatedMessage = await measurePerformanceAsync(async () => {
          return await messageManager.updateMessage(messageId, userId, processedContent);
        }, 'Mesaj güncelleme (eski modül)');
      } else {
        throw new Error('Mesaj servisi bulunamadı');
      }

      if (!updatedMessage) {
        throw new Error('Mesaj güncellenemedi');
      }

      // Mesajın bulunduğu kanala güncelleme bilgisini gönder
      const channelId = updatedMessage.channel
        ? updatedMessage.channel.toString()
        : updatedMessage.channelId;

      socket.to(channelId).emit('message:update', {
        messageId,
        content: processedContent,
        updatedAt: updatedMessage.updatedAt
          ? updatedMessage.updatedAt.toISOString()
          : new Date().toISOString(),
        isEdited: true,
      });

      logger.debug('Mesaj güncellendi', {
        userId,
        username,
        messageId,
        channelId,
      });
    } catch (error) {
      logger.error('Mesaj güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
      });

      socket.emit('error', {
        message: 'Mesaj güncellenemedi',
        code: 'MESSAGE_UPDATE_ERROR',
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
      let deletedMessage;
      let success = false;

      if (messageService) {
        // Yeni servis kullan
        success = await measurePerformanceAsync(async () => {
          return await messageService.deleteMessage(messageId, userId);
        }, 'Mesaj silme (yeni servis)');

        // Mesaj bilgilerini al
        if (success) {
          deletedMessage = await messageService.getMessageById(messageId);
        }
      } else if (messageManager) {
        // Eski modülü kullan
        deletedMessage = await measurePerformanceAsync(async () => {
          return await messageManager.deleteMessage(messageId, userId);
        }, 'Mesaj silme (eski modül)');

        success = !!deletedMessage;
      } else {
        throw new Error('Mesaj servisi bulunamadı');
      }

      if (!success && !deletedMessage) {
        throw new Error('Mesaj silinemedi');
      }

      // Mesajın bulunduğu kanala silme bilgisini gönder
      const channelId =
        deletedMessage && deletedMessage.channel
          ? deletedMessage.channel.toString()
          : deletedMessage
            ? deletedMessage.channelId
            : null;

      if (channelId) {
        socket.to(channelId).emit('message:delete', {
          messageId,
          channelId,
        });
      }

      logger.debug('Mesaj silindi', {
        userId,
        username,
        messageId,
        channelId,
      });
    } catch (error) {
      logger.error('Mesaj silme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
      });

      socket.emit('error', {
        message: 'Mesaj silinemedi',
        code: 'MESSAGE_DELETE_ERROR',
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
      await measurePerformanceAsync(async () => {
        await messageManager.markMessageAsRead(messageId, userId);
      }, 'Mesaj okundu işaretleme');

      // Kanaldaki diğer kullanıcılara okundu bilgisini gönder
      socket.to(channelId).emit('message:read', {
        messageId,
        userId,
        username,
      });

      logger.debug('Mesaj okundu işaretlendi', {
        userId,
        username,
        messageId,
      });
    } catch (error) {
      logger.error('Mesaj okundu işaretleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
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
      let success = false;

      if (messageService) {
        // Yeni servis kullan
        success = await measurePerformanceAsync(async () => {
          return await messageService.addReaction(messageId, userId, emoji);
        }, 'Mesaj tepki ekleme (yeni servis)');
      } else if (messageManager) {
        // Eski modülü kullan
        const reaction = await measurePerformanceAsync(async () => {
          return await messageManager.addReaction(messageId, userId, emoji);
        }, 'Mesaj tepki ekleme (eski modül)');

        success = !!reaction;
      } else {
        throw new Error('Mesaj servisi bulunamadı');
      }

      if (!success) {
        throw new Error('Tepki eklenemedi');
      }

      // Mesajın bulunduğu kanala tepki bilgisini gönder
      let channelId;

      if (messageService) {
        const message = await messageService.getMessageById(messageId);
        if (message) {
          channelId = message.channel ? message.channel.toString() : message.channelId;
        }
      } else if (messageManager) {
        const message = await messageManager.getMessage(messageId);
        if (message) {
          channelId = message.channel.toString();
        }
      }

      if (channelId) {
        socket.to(channelId).emit('message:reaction', {
          messageId,
          userId,
          username,
          emoji,
        });
      }

      logger.debug('Mesaja tepki eklendi', {
        userId,
        username,
        messageId,
        emoji,
        channelId,
      });
    } catch (error) {
      logger.error('Mesaj tepki ekleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
        emoji,
      });

      socket.emit('error', {
        message: 'Tepki eklenemedi',
        code: 'REACTION_ADD_ERROR',
      });
    }
  });

  /**
   * Yazıyor... olayı
   */
  socket.on('user:typing', async (data) => {
    const { channelId, isTyping } = data;

    try {
      // Kanaldaki diğer kullanıcılara yazıyor bilgisini gönder
      socket.to(channelId).emit('user:typing', {
        channelId,
        userId,
        username,
        isTyping,
      });

      logger.debug('Yazıyor durumu güncellendi', {
        userId,
        username,
        channelId,
        isTyping,
      });
    } catch (error) {
      logger.error('Yazıyor durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId,
      });
    }
  });

  /**
   * Mesaj tepkisini kaldırma olayı
   */
  socket.on('message:reaction:remove', async (data) => {
    const { messageId, emoji } = data;

    try {
      // Mesajdan tepkiyi kaldır
      let success = false;

      if (messageService) {
        // Yeni servis kullan
        success = await measurePerformanceAsync(async () => {
          return await messageService.removeReaction(messageId, userId, emoji);
        }, 'Mesaj tepki kaldırma (yeni servis)');
      } else if (messageManager && messageManager.removeReaction) {
        // Eski modülü kullan (eğer metot varsa)
        success = await measurePerformanceAsync(async () => {
          return await messageManager.removeReaction(messageId, userId, emoji);
        }, 'Mesaj tepki kaldırma (eski modül)');
      } else {
        throw new Error('Mesaj servisi bulunamadı veya tepki kaldırma metodu yok');
      }

      if (!success) {
        throw new Error('Tepki kaldırılamadı');
      }

      // Mesajın bulunduğu kanala tepki kaldırma bilgisini gönder
      let channelId;

      if (messageService) {
        const message = await messageService.getMessageById(messageId);
        if (message) {
          channelId = message.channel ? message.channel.toString() : message.channelId;
        }
      } else if (messageManager) {
        const message = await messageManager.getMessage(messageId);
        if (message) {
          channelId = message.channel.toString();
        }
      }

      if (channelId) {
        socket.to(channelId).emit('message:reaction:remove', {
          messageId,
          userId,
          emoji,
        });
      }

      logger.debug('Mesajdan tepki kaldırıldı', {
        userId,
        username,
        messageId,
        emoji,
        channelId,
      });
    } catch (error) {
      logger.error('Mesaj tepki kaldırma hatası', {
        error: (error as Error).message,
        userId,
        username,
        messageId,
        emoji,
      });

      socket.emit('error', {
        message: 'Tepki kaldırılamadı',
        code: 'REACTION_REMOVE_ERROR',
      });
    }
  });
}
