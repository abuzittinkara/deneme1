/**
 * src/socket/handlers/friendHandlers.ts
 * Arkadaşlık olayları için Socket.IO işleyicileri
 */
import { TypedSocket, ClientToServerEvents } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';

/**
 * Arkadaşlık olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerFriendHandlers(
  socket: TypedSocket,
  dependencies: any
): void {
  const { friendManager, notificationManager, users } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Arkadaşlık isteği gönderme olayı
   */
  // @ts-ignore - Tip uyumsuzluğunu geçici olarak görmezden gel
  socket.on('friend:request', async (data: { receiverId: string }) => {
    const { receiverId } = data;

    try {
      // Arkadaşlık isteği gönder
      const request = await measurePerformanceAsync(
        async () => {
          return await friendManager.sendFriendRequest(userId, receiverId);
        },
        'Arkadaşlık isteği gönderme'
      );

      if (!request) {
        throw new Error('Arkadaşlık isteği gönderilemedi');
      }

      // Alıcıya bildirim gönder
      if (users[receiverId]) {
        // Alıcı çevrimiçiyse, soketlerine bildirim gönder
        for (const socketId of users[receiverId]) {
          socket.to(socketId).emit('friend:request', {
            senderId: userId,
            senderUsername: username,
            receiverId
          });
        }
      }

      // Bildirim oluştur
      await notificationManager.createFriendRequestNotification(receiverId, userId);

      logger.debug('Arkadaşlık isteği gönderildi', {
        userId,
        username,
        receiverId
      });
    } catch (error) {
      logger.error('Arkadaşlık isteği gönderme hatası', {
        error: (error as Error).message,
        userId,
        username,
        receiverId
      });

      socket.emit('error', {
        message: 'Arkadaşlık isteği gönderilemedi',
        code: 'FRIEND_REQUEST_ERROR'
      });
    }
  });

  /**
   * Arkadaşlık isteği kabul etme olayı
   */
  // @ts-ignore - Tip uyumsuzluğunu geçici olarak görmezden gel
  socket.on('friend:accept', async (data: { senderId: string }) => {
    const { senderId } = data;

    try {
      // Arkadaşlık isteğini kabul et
      const success = await measurePerformanceAsync(
        async () => {
          return await friendManager.acceptFriendRequest(senderId, userId);
        },
        'Arkadaşlık isteği kabul etme'
      );

      if (!success) {
        throw new Error('Arkadaşlık isteği kabul edilemedi');
      }

      // Gönderene bildirim gönder
      if (users[senderId]) {
        // Gönderen çevrimiçiyse, soketlerine bildirim gönder
        for (const socketId of users[senderId]) {
          socket.to(socketId).emit('friend:accept', {
            senderId,
            receiverId: userId
          });
        }
      }

      // Bildirim oluştur
      await notificationManager.createFriendAcceptNotification(senderId, userId);

      logger.debug('Arkadaşlık isteği kabul edildi', {
        userId,
        username,
        senderId
      });
    } catch (error) {
      logger.error('Arkadaşlık isteği kabul etme hatası', {
        error: (error as Error).message,
        userId,
        username,
        senderId
      });

      socket.emit('error', {
        message: 'Arkadaşlık isteği kabul edilemedi',
        code: 'FRIEND_ACCEPT_ERROR'
      });
    }
  });

  /**
   * Arkadaşlık isteği reddetme olayı
   */
  // @ts-ignore - Tip uyumsuzluğunu geçici olarak görmezden gel
  socket.on('friend:reject', async (data: { senderId: string }) => {
    const { senderId } = data;

    try {
      // Arkadaşlık isteğini reddet
      const success = await measurePerformanceAsync(
        async () => {
          return await friendManager.rejectFriendRequest(senderId, userId);
        },
        'Arkadaşlık isteği reddetme'
      );

      if (!success) {
        throw new Error('Arkadaşlık isteği reddedilemedi');
      }

      logger.debug('Arkadaşlık isteği reddedildi', {
        userId,
        username,
        senderId
      });
    } catch (error) {
      logger.error('Arkadaşlık isteği reddetme hatası', {
        error: (error as Error).message,
        userId,
        username,
        senderId
      });

      socket.emit('error', {
        message: 'Arkadaşlık isteği reddedilemedi',
        code: 'FRIEND_REJECT_ERROR'
      });
    }
  });

  /**
   * Arkadaşlıktan çıkarma olayı
   */
  // @ts-ignore - Tip uyumsuzluğunu geçici olarak görmezden gel
  socket.on('friend:remove', async (data: { friendId: string }) => {
    const { friendId } = data;

    try {
      // Arkadaşlıktan çıkar
      const success = await measurePerformanceAsync(
        async () => {
          return await friendManager.removeFriend(userId, friendId);
        },
        'Arkadaşlıktan çıkarma'
      );

      if (!success) {
        throw new Error('Arkadaşlıktan çıkarılamadı');
      }

      // Arkadaşa bildirim gönder
      if (users[friendId]) {
        // Arkadaş çevrimiçiyse, soketlerine bildirim gönder
        for (const socketId of users[friendId]) {
          // @ts-ignore - Tip uyumsuzluğunu geçici olarak görmezden gel
          socket.to(socketId).emit('friend:remove', {
            userId,
            friendId
          });
        }
      }

      logger.debug('Arkadaşlıktan çıkarıldı', {
        userId,
        username,
        friendId
      });
    } catch (error) {
      logger.error('Arkadaşlıktan çıkarma hatası', {
        error: (error as Error).message,
        userId,
        username,
        friendId
      });

      socket.emit('error', {
        message: 'Arkadaşlıktan çıkarılamadı',
        code: 'FRIEND_REMOVE_ERROR'
      });
    }
  });
}
