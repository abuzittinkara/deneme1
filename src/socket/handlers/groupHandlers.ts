/**
 * src/socket/handlers/groupHandlers.ts
 * Grup ve kanal olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';
import { UserRole, UserStatus } from '../../types/common';

/**
 * Grup ve kanal olayları için işleyicileri kaydeder
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerGroupHandlers(socket: TypedSocket, dependencies: any): void {
  const { groupManager, channelManager, notificationManager, userManager } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  /**
   * Gruba katılma olayı
   */
  socket.on('group:join', async (data) => {
    const { groupId } = data;

    try {
      // Kullanıcıyı gruba ekle
      const group = await measurePerformanceAsync(async () => {
        return await groupManager.joinGroup(groupId, userId);
      }, 'Gruba katılma');

      if (!group) {
        throw new Error('Gruba katılınamadı');
      }

      // Grup odasına katıl
      socket.join(groupId);

      // Gruptaki tüm kanallara katıl
      for (const channel of group.channels) {
        socket.join(channel._id.toString());
      }

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserById(userId);

      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Gruptaki diğer kullanıcılara katılma bilgisini gönder
      socket.to(groupId).emit('member:join', {
        groupId,
        user: {
          id: userId,
          username: user.username,
          displayName: user.displayName || user.username,
          email: user.email,
          avatar: user.avatar || '',
          status: UserStatus.ONLINE,
          role: UserRole.MEMBER,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });

      logger.debug('Kullanıcı gruba katıldı', {
        userId,
        username,
        groupId,
      });
    } catch (error) {
      logger.error('Gruba katılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        groupId,
      });

      socket.emit('error', {
        message: 'Gruba katılınamadı',
        code: 'GROUP_JOIN_ERROR',
      });
    }
  });

  /**
   * Gruptan ayrılma olayı
   */
  socket.on('group:leave', async (data) => {
    const { groupId } = data;

    try {
      // Kullanıcıyı gruptan çıkar
      const success = await measurePerformanceAsync(async () => {
        return await groupManager.leaveGroup(groupId, userId);
      }, 'Gruptan ayrılma');

      if (!success) {
        throw new Error('Gruptan ayrılınamadı');
      }

      // Grup odasından ayrıl
      socket.leave(groupId);

      // Gruptaki tüm kanallardan ayrıl
      const channels = await channelManager.getGroupChannels(groupId);
      for (const channel of channels) {
        socket.leave(channel._id.toString());
      }

      // Gruptaki diğer kullanıcılara ayrılma bilgisini gönder
      socket.to(groupId).emit('member:leave', {
        groupId,
        userId,
      });

      logger.debug('Kullanıcı gruptan ayrıldı', {
        userId,
        username,
        groupId,
      });
    } catch (error) {
      logger.error('Gruptan ayrılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        groupId,
      });

      socket.emit('error', {
        message: 'Gruptan ayrılınamadı',
        code: 'GROUP_LEAVE_ERROR',
      });
    }
  });

  /**
   * Kanala katılma olayı
   */
  socket.on('channel:join', async (data) => {
    const { channelId } = data;

    try {
      // Kullanıcıyı kanala ekle
      const channel = await measurePerformanceAsync(async () => {
        return await channelManager.joinChannel(channelId, userId);
      }, 'Kanala katılma');

      if (!channel) {
        throw new Error('Kanala katılınamadı');
      }

      // Kanal odasına katıl
      socket.join(channelId);

      // Kullanıcı bilgilerini al
      const user = await userManager.getUserById(userId);

      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Kanaldaki diğer kullanıcılara katılma bilgisini gönder
      socket.to(channelId).emit('member:join', {
        groupId: channel.group.toString(),
        user: {
          id: userId,
          username: user.username,
          displayName: user.displayName || user.username,
          email: user.email,
          avatar: user.avatar || '',
          status: UserStatus.ONLINE,
          role: UserRole.MEMBER,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });

      logger.debug('Kullanıcı kanala katıldı', {
        userId,
        username,
        channelId,
      });
    } catch (error) {
      logger.error('Kanala katılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId,
      });

      socket.emit('error', {
        message: 'Kanala katılınamadı',
        code: 'CHANNEL_JOIN_ERROR',
      });
    }
  });

  /**
   * Kanaldan ayrılma olayı
   */
  socket.on('channel:leave', async (data) => {
    const { channelId } = data;

    try {
      // Kullanıcıyı kanaldan çıkar
      const channel = await measurePerformanceAsync(async () => {
        return await channelManager.leaveChannel(channelId, userId);
      }, 'Kanaldan ayrılma');

      if (!channel) {
        throw new Error('Kanaldan ayrılınamadı');
      }

      // Kanal odasından ayrıl
      socket.leave(channelId);

      // Kanaldaki diğer kullanıcılara ayrılma bilgisini gönder
      socket.to(channelId).emit('member:leave', {
        groupId: channel.group.toString(),
        userId,
      });

      logger.debug('Kullanıcı kanaldan ayrıldı', {
        userId,
        username,
        channelId,
      });
    } catch (error) {
      logger.error('Kanaldan ayrılma hatası', {
        error: (error as Error).message,
        userId,
        username,
        channelId,
      });

      socket.emit('error', {
        message: 'Kanaldan ayrılınamadı',
        code: 'CHANNEL_LEAVE_ERROR',
      });
    }
  });
}
