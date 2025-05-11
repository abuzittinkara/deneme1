/**
 * src/socket/handlers/presenceHandlers.ts
 * Kullanıcı çevrimiçi durumu olayları için Socket.IO işleyicileri
 */
import { TypedSocket } from '../../types/socket';
import { logger } from '../../utils/logger';
import { measurePerformanceAsync } from '../../utils/performance';
import { UserStatus } from '../../types/enums';

// Çevrimiçi kullanıcıları takip etmek için Map
const onlineUsers = new Map<
  string,
  {
    userId: string;
    username: string;
    status: UserStatus;
    lastActivity: Date;
    socketIds: Set<string>;
  }
>();

/**
 * Kullanıcı çevrimiçi durumu olaylarını kaydet
 * @param socket - Socket.IO soketi
 * @param dependencies - Bağımlılıklar
 */
export function registerPresenceHandlers(
  socket: TypedSocket,
  dependencies: Record<string, any>
): void {
  const { userService } = dependencies;
  const userId = socket.data.userId;
  const username = socket.data.username;

  // Kullanıcı bağlandığında
  handleUserConnect(socket, userId, username, userService);

  // Kullanıcı durumu değiştiğinde
  socket.on('presence:status', async (data) => {
    const { status } = data;

    try {
      // Kullanıcı durumunu güncelle
      await updateUserStatus(socket, userId, username, status, userService);

      logger.debug('Kullanıcı durumu güncellendi', {
        userId,
        username,
        status,
      });
    } catch (error) {
      logger.error('Kullanıcı durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
        status,
      });

      socket.emit('error', {
        message: 'Kullanıcı durumu güncellenemedi',
        code: 'PRESENCE_STATUS_ERROR',
      });
    }
  });

  // Kullanıcı aktivitesi
  socket.on('presence:activity', () => {
    try {
      // Kullanıcı aktivitesini güncelle
      updateUserActivity(userId);

      logger.debug('Kullanıcı aktivitesi güncellendi', {
        userId,
        username,
      });
    } catch (error) {
      logger.error('Kullanıcı aktivitesi güncelleme hatası', {
        error: (error as Error).message,
        userId,
        username,
      });
    }
  });

  // Kullanıcı bağlantısı kesildiğinde
  socket.on('disconnect', () => {
    handleUserDisconnect(socket, userId, username, userService);
  });
}

/**
 * Kullanıcı bağlandığında
 * @param socket - Socket.IO soketi
 * @param userId - Kullanıcı ID
 * @param username - Kullanıcı adı
 * @param userService - Kullanıcı servisi
 */
async function handleUserConnect(
  socket: TypedSocket,
  userId: string,
  username: string,
  userService: any
): Promise<void> {
  try {
    // Kullanıcı çevrimiçi durumunu güncelle
    const user = onlineUsers.get(userId);

    if (user) {
      // Kullanıcı zaten çevrimiçi, soket ID'sini ekle
      user.socketIds.add(socket.id);
      user.lastActivity = new Date();
    } else {
      // Yeni çevrimiçi kullanıcı
      onlineUsers.set(userId, {
        userId,
        username,
        status: UserStatus.ONLINE,
        lastActivity: new Date(),
        socketIds: new Set([socket.id]),
      });

      // Diğer kullanıcılara çevrimiçi durumunu bildir
      socket.broadcast.emit('presence:online', {
        userId,
        username,
        status: UserStatus.ONLINE,
      });
    }

    // Veritabanında kullanıcı durumunu güncelle
    if (userService) {
      await measurePerformanceAsync(async () => {
        await userService.updateUser(userId, {
          status: UserStatus.ONLINE,
          'onlineStatus.isOnline': true,
          'onlineStatus.lastActiveAt': new Date(),
        });
      }, 'Kullanıcı çevrimiçi durumu güncelleme');
    }

    // Kullanıcıya çevrimiçi kullanıcıları gönder
    const onlineUsersList = Array.from(onlineUsers.values()).map((user) => ({
      userId: user.userId,
      username: user.username,
      status: user.status,
    }));

    socket.emit('presence:list', {
      users: onlineUsersList,
    });

    logger.debug('Kullanıcı bağlandı', {
      userId,
      username,
      socketId: socket.id,
    });
  } catch (error) {
    logger.error('Kullanıcı bağlantı hatası', {
      error: (error as Error).message,
      userId,
      username,
      socketId: socket.id,
    });
  }
}

/**
 * Kullanıcı bağlantısı kesildiğinde
 * @param socket - Socket.IO soketi
 * @param userId - Kullanıcı ID
 * @param username - Kullanıcı adı
 * @param userService - Kullanıcı servisi
 */
async function handleUserDisconnect(
  socket: TypedSocket,
  userId: string,
  username: string,
  userService: any
): Promise<void> {
  try {
    // Kullanıcı çevrimiçi durumunu güncelle
    const user = onlineUsers.get(userId);

    if (user) {
      // Soket ID'sini kaldır
      user.socketIds.delete(socket.id);

      // Kullanıcının başka soketleri var mı kontrol et
      if (user.socketIds.size === 0) {
        // Kullanıcının başka soketi yok, çevrimdışı olarak işaretle
        onlineUsers.delete(userId);

        // Diğer kullanıcılara çevrimdışı durumunu bildir
        socket.broadcast.emit('presence:offline', {
          userId,
          username,
        });

        // Veritabanında kullanıcı durumunu güncelle
        if (userService) {
          await measurePerformanceAsync(async () => {
            await userService.updateUser(userId, {
              status: UserStatus.OFFLINE,
              'onlineStatus.isOnline': false,
              'onlineStatus.lastActiveAt': new Date(),
            });
          }, 'Kullanıcı çevrimdışı durumu güncelleme');
        }
      }
    }

    logger.debug('Kullanıcı bağlantısı kesildi', {
      userId,
      username,
      socketId: socket.id,
      reason: socket.disconnected ? 'client disconnect' : 'unknown',
    });
  } catch (error) {
    logger.error('Kullanıcı bağlantı kesme hatası', {
      error: (error as Error).message,
      userId,
      username,
      socketId: socket.id,
    });
  }
}

/**
 * Kullanıcı durumunu güncelle
 * @param socket - Socket.IO soketi
 * @param userId - Kullanıcı ID
 * @param username - Kullanıcı adı
 * @param status - Kullanıcı durumu
 * @param userService - Kullanıcı servisi
 */
async function updateUserStatus(
  socket: TypedSocket,
  userId: string,
  username: string,
  status: UserStatus,
  userService: any
): Promise<void> {
  // Kullanıcı çevrimiçi durumunu güncelle
  const user = onlineUsers.get(userId);

  if (user) {
    // Durumu güncelle
    user.status = status;
    user.lastActivity = new Date();

    // Diğer kullanıcılara durum değişikliğini bildir
    socket.broadcast.emit('presence:status', {
      userId,
      username,
      status,
    });

    // Veritabanında kullanıcı durumunu güncelle
    if (userService) {
      await measurePerformanceAsync(async () => {
        await userService.updateUser(userId, {
          status,
          'onlineStatus.lastActiveAt': new Date(),
        });
      }, 'Kullanıcı durumu güncelleme');
    }
  }
}

/**
 * Kullanıcı aktivitesini güncelle
 * @param userId - Kullanıcı ID
 */
function updateUserActivity(userId: string): void {
  // Kullanıcı çevrimiçi durumunu güncelle
  const user = onlineUsers.get(userId);

  if (user) {
    // Aktivite zamanını güncelle
    user.lastActivity = new Date();
  }
}

/**
 * Çevrimiçi kullanıcıları getir
 * @returns Çevrimiçi kullanıcılar
 */
export function getOnlineUsers(): Array<{
  userId: string;
  username: string;
  status: UserStatus;
}> {
  return Array.from(onlineUsers.values()).map((user) => ({
    userId: user.userId,
    username: user.username,
    status: user.status,
  }));
}

/**
 * Kullanıcının çevrimiçi olup olmadığını kontrol et
 * @param userId - Kullanıcı ID
 * @returns Kullanıcı çevrimiçi mi
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Kullanıcının durumunu getir
 * @param userId - Kullanıcı ID
 * @returns Kullanıcı durumu
 */
export function getUserStatus(userId: string): UserStatus | null {
  const user = onlineUsers.get(userId);
  return user ? user.status : null;
}

export default {
  registerPresenceHandlers,
  getOnlineUsers,
  isUserOnline,
  getUserStatus,
};
