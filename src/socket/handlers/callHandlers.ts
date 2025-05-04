/**
 * src/socket/handlers/callHandlers.ts
 * Sesli/görüntülü görüşme olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';

/**
 * Sesli/görüntülü görüşme olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerCallHandlers(
  socket: TypedSocket,
  dependencies: any
): void {
  const { sfu, userManager } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Görüşme başlatma olayı
   */
  socket.on('call:start', async (data) => {
    const { channelId } = data;

    try {
      // Görüşme oluştur
      const call = await measurePerformanceAsync(
        async () => {
          return await sfu.createRoom(channelId, userId);
        },
        'Görüşme başlatma'
      );

      if (!call) {
        throw new Error('Görüşme başlatılamadı');
      }

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserProfile(userId);

      // Kanaldaki diğer kullanıcılara görüşme başlatma bilgisini gönder
      socket.to(channelId).emit('call:start', {
        callId: call.id,
        channelId,
        initiator: user,
        participants: [user]
      });

      logger.debug('Görüşme başlatıldı', {
        userId,
        username,
        channelId,
        callId: call.id
      });
    } catch (error) {
      logger.error('Görüşme başlatma hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId
      });

      socket.emit('error', {
        message: 'Görüşme başlatılamadı',
        code: 'CALL_START_ERROR'
      });
    }
  });

  /**
   * Görüşmeye katılma olayı
   */
  socket.on('call:join', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeye katıl
      const room = await measurePerformanceAsync(
        async () => {
          return await sfu.joinRoom(callId, userId);
        },
        'Görüşmeye katılma'
      );

      if (!room) {
        throw new Error('Görüşmeye katılınamadı');
      }

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserProfile(userId);

      // Görüşmedeki diğer kullanıcılara katılma bilgisini gönder
      socket.to(room.id).emit('call:join', {
        callId,
        user
      });

      logger.debug('Görüşmeye katıldı', {
        userId,
        username,
        callId
      });
    } catch (error) {
      logger.error('Görüşmeye katılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId
      });

      socket.emit('error', {
        message: 'Görüşmeye katılınamadı',
        code: 'CALL_JOIN_ERROR'
      });
    }
  });

  /**
   * Görüşmeden ayrılma olayı
   */
  socket.on('call:leave', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeden ayrıl
      const success = await measurePerformanceAsync(
        async () => {
          return await sfu.leaveRoom(callId, userId);
        },
        'Görüşmeden ayrılma'
      );

      if (!success) {
        throw new Error('Görüşmeden ayrılınamadı');
      }

      // Görüşmedeki diğer kullanıcılara ayrılma bilgisini gönder
      socket.to(callId).emit('call:leave', {
        callId,
        userId
      });

      logger.debug('Görüşmeden ayrıldı', {
        userId,
        username,
        callId
      });
    } catch (error) {
      logger.error('Görüşmeden ayrılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId
      });

      socket.emit('error', {
        message: 'Görüşmeden ayrılınamadı',
        code: 'CALL_LEAVE_ERROR'
      });
    }
  });

  /**
   * Görüşmeyi sonlandırma olayı
   */
  socket.on('call:end', async (data) => {
    const { callId } = data;

    try {
      // Görüşmeyi sonlandır
      const success = await measurePerformanceAsync(
        async () => {
          return await sfu.closeRoom(callId, userId);
        },
        'Görüşmeyi sonlandırma'
      );

      if (!success) {
        throw new Error('Görüşme sonlandırılamadı');
      }

      // Görüşmedeki diğer kullanıcılara sonlandırma bilgisini gönder
      socket.to(callId).emit('call:end', {
        callId
      });

      logger.debug('Görüşme sonlandırıldı', {
        userId,
        username,
        callId
      });
    } catch (error) {
      logger.error('Görüşme sonlandırma hatası', {
        error: (error as Error).message,
        userId,
        username,
        callId
      });

      socket.emit('error', {
        message: 'Görüşme sonlandırılamadı',
        code: 'CALL_END_ERROR'
      });
    }
  });
}
