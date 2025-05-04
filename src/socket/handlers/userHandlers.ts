/**
 * src/socket/handlers/userHandlers.ts
 * Kullanıcı olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';
import { UserStatus } from '../../types/common';

/**
 * Kullanıcı olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerUserHandlers(
  socket: TypedSocket,
  dependencies: any
): void {
  const { userManager, friendManager, users, onlineUsernames } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Kullanıcı durumu değiştirme olayı
   */
  socket.on('user:status', async (data) => {
    const { status } = data;

    try {
      // Kullanıcı durumunu güncelle
      await measurePerformanceAsync(
        async () => {
          await userManager.updateUserStatus(userId, status);
        },
        'Kullanıcı durumu güncelleme'
      );

      // Tüm kullanıcılara durum değişikliğini bildir
      socket.broadcast.emit('user:status', {
        userId,
        username,
        status
      });

      logger.debug('Kullanıcı durumu güncellendi', {
        userId,
        username,
        status
      });
    } catch (error) {
      logger.error('Kullanıcı durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        status
      });

      socket.emit('error', {
        message: 'Durum güncellenemedi',
        code: 'STATUS_UPDATE_ERROR'
      });
    }
  });

  /**
   * Yazıyor... olayı
   */
  socket.on('typing', (data) => {
    const { channelId, isTyping } = data;

    try {
      // Kanaldaki diğer kullanıcılara yazıyor bilgisini gönder
      socket.to(channelId).emit('user:typing', {
        userId,
        username,
        channelId,
        isTyping
      });

      logger.debug('Kullanıcı yazıyor durumu gönderildi', {
        userId,
        username,
        channelId,
        isTyping
      });
    } catch (error) {
      logger.error('Yazıyor durumu gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId
      });
    }
  });

  /**
   * Bağlantı kesme olayı
   */
  socket.on('disconnect', () => {
    logger.info('Kullanıcı bağlantısı kesildi', {
      userId,
      username,
      socketId: socket.id
    });

    // Kullanıcının socket ID'sini kaldır
    if (users[userId]) {
      const index = users[userId].indexOf(socket.id);
      if (index !== -1) {
        users[userId].splice(index, 1);
      }

      // Eğer kullanıcının başka bağlantısı kalmadıysa, çevrimdışı olarak işaretle
      if (users[userId].length === 0) {
        delete users[userId];
        delete onlineUsernames[userId];

        // Kullanıcı durumunu güncelle
        userManager.updateUserStatus(userId, UserStatus.OFFLINE);

        // Kullanıcının bağlantı kesme durumunu bildir
        socket.broadcast.emit('user:disconnect', { userId, username });
      }
    }
  });
}
