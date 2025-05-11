/**
 * src/socket/handlers/voiceHandlers.ts
 * Ses kanalı olayları için işleyicileri kaydeder
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';

/**
 * Ses kanalı olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerVoiceHandlers(
  socket: TypedSocket,
  dependencies: Record<string, any>
): void {
  const { callManager } = dependencies;
  const userId = socket.data.userId || socket.id; // Kullanıcı ID yoksa socket ID kullan
  const username = socket.data.username || 'Misafir';

  /**
   * Ses kanalına katılma olayı
   */
  socket.on('joinVoiceChannel', async (data, callback) => {
    try {
      const { channelId, groupId, listenOnly = false } = data;

      if (!channelId) {
        return callback({ success: false, error: 'Geçersiz kanal ID' });
      }

      // Kullanıcının ses kanalına katıldığını kaydet
      await callManager.joinVoiceChannel(userId, channelId, { listenOnly });

      // Kullanıcının katıldığı odadaki diğer kullanıcıları al
      const usersInRoom = await callManager.getUsersInVoiceChannel(channelId);

      // Odadaki diğer kullanıcılara bildirim gönder
      socket.to(channelId).emit('userJoinedVoice', {
        userId,
        username,
        listenOnly,
      });

      // Kullanıcıyı odaya ekle
      socket.join(channelId);

      logger.info('Kullanıcı ses kanalına katıldı', {
        userId,
        username,
        channelId,
        groupId,
        listenOnly,
        usersCount: usersInRoom.length,
      });

      callback({
        success: true,
        users: usersInRoom.filter((id) => id !== userId),
      });
    } catch (error) {
      logger.error('Ses kanalına katılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ success: false, error: 'Ses kanalına katılırken bir hata oluştu' });
    }
  });

  /**
   * Ses kanalından ayrılma olayı
   */
  socket.on('leaveVoiceChannel', async (data, callback) => {
    try {
      const { channelId } = data;

      if (!channelId) {
        return callback({ success: false, error: 'Geçersiz kanal ID' });
      }

      // Kullanıcının ses kanalından ayrıldığını kaydet
      await callManager.leaveVoiceChannel(userId, channelId);

      // Odadaki diğer kullanıcılara bildirim gönder
      socket.to(channelId).emit('userLeftVoice', { userId, username });

      // Kullanıcıyı odadan çıkar
      socket.leave(channelId);

      logger.info('Kullanıcı ses kanalından ayrıldı', {
        userId,
        username,
        channelId,
      });

      callback({ success: true });
    } catch (error) {
      logger.error('Ses kanalından ayrılırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });

      callback({ success: false, error: 'Ses kanalından ayrılırken bir hata oluştu' });
    }
  });

  /**
   * Mikrofon durumu güncelleme olayı
   */
  socket.on('updateMicState', async (data) => {
    try {
      const { channelId, enabled } = data;

      if (!channelId) {
        return;
      }

      // Mikrofon durumunu güncelle
      await callManager.updateMediaState({
        callId: channelId,
        userId,
        audio: enabled,
        video: false,
      });

      // Odadaki diğer kullanıcılara bildirim gönder
      socket.to(channelId).emit('micStateChanged', {
        userId,
        enabled,
      });

      logger.debug('Mikrofon durumu güncellendi', {
        userId,
        username,
        channelId,
        enabled,
      });
    } catch (error) {
      logger.error('Mikrofon durumu güncellenirken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId,
        data,
      });
    }
  });
}
