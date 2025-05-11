/**
 * src/socket/socketManager.ts
 * Socket.IO bağlantı yönetimi
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { createSocketEventHandler } from './socketEventHandler';

// Aktif bağlantıları izle
const activeConnections = new Map<string, Set<string>>();

// Socket.IO sunucusunu yapılandır
export function configureSocketServer(io: SocketIOServer): void {
  // Middleware: Kimlik doğrulama
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth['token']) ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Socket bağlantısı için token bulunamadı', {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next(new Error('Kimlik doğrulama gerekli'));
      }

      // Token'ı doğrula
      const decoded = await verifyToken(token);

      // Kullanıcıyı bul
      const userId = decoded.sub || decoded.id;
      if (!userId) {
        return next(new Error('Geçersiz token: Kullanıcı ID bulunamadı'));
      }

      const user = await User.findById(userId);

      if (!user) {
        logger.warn('Socket bağlantısı için kullanıcı bulunamadı', {
          socketId: socket.id,
          userId: userId,
          ip: socket.handshake.address,
        });
        return next(new Error('Kullanıcı bulunamadı'));
      }

      // Socket nesnesine kullanıcı bilgilerini ekle
      (socket as any).user = user;

      logger.debug('Socket kimlik doğrulama başarılı', {
        socketId: socket.id,
        userId: user.id,
        username: user.get('username'),
      });

      next();
    } catch (error) {
      logger.error('Socket kimlik doğrulama hatası', {
        error: (error as Error).message,
        ip: socket.handshake.address,
        socketId: socket.id,
      });

      next(new Error('Geçersiz token'));
    }
  });

  // Bağlantı olayı
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;

    if (!user) {
      logger.warn('Kimlik doğrulaması olmadan socket bağlantısı', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });

      socket.disconnect();
      return;
    }

    // Kullanıcı bağlantılarını izle
    if (!activeConnections.has(user.id)) {
      activeConnections.set(user.id, new Set());
    }

    activeConnections.get(user.id)!.add(socket.id);

    logger.info('Kullanıcı bağlandı', {
      userId: user.id,
      username: user.get('username'),
      socketId: socket.id,
      connectionCount: activeConnections.get(user.id)!.size,
    });

    // Kullanıcı durumunu güncelle
    updateUserStatus(user.id, true);

    // Bağlantı kesilme olayı
    socket.on('disconnect', () => {
      if (activeConnections.has(user.id)) {
        activeConnections.get(user.id)!.delete(socket.id);

        // Kullanıcının başka bağlantısı yoksa çevrimdışı olarak işaretle
        if (activeConnections.get(user.id)!.size === 0) {
          activeConnections.delete(user.id);
          updateUserStatus(user.id, false);
        }
      }

      logger.info('Kullanıcı bağlantısı kesildi', {
        userId: user.id,
        username: user.get('username'),
        socketId: socket.id,
        remainingConnections: activeConnections.get(user.id)?.size || 0,
      });
    });

    // Hata olayı
    socket.on('error', (error) => {
      logger.error('Socket hatası', {
        error: error.message,
        userId: user.id,
        socketId: socket.id,
      });
    });

    // Ping olayı (bağlantı kontrolü)
    socket.on(
      'ping',
      createSocketEventHandler(async (socket, data, callback) => {
        if (callback) {
          callback({
            success: true,
            data: {
              time: new Date().toISOString(),
              message: 'pong',
            },
          });
        }
      })
    );
  });

  // Periyodik olarak bağlantı istatistiklerini logla
  setInterval(
    () => {
      const totalConnections = Array.from(activeConnections.values()).reduce(
        (sum, connections) => sum + connections.size,
        0
      );
      const totalUsers = activeConnections.size;

      logger.debug('Socket bağlantı istatistikleri', {
        totalConnections,
        totalUsers,
        connectionsPerUser: totalUsers > 0 ? (totalConnections / totalUsers).toFixed(2) : '0',
      });
    },
    5 * 60 * 1000
  ); // 5 dakikada bir
}

/**
 * Kullanıcı durumunu günceller
 * @param userId Kullanıcı ID
 * @param isOnline Çevrimiçi mi?
 */
async function updateUserStatus(userId: string, isOnline: boolean): Promise<void> {
  try {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'onlineStatus.isOnline': isOnline,
          'onlineStatus.lastActiveAt': new Date(),
        },
      }
    );

    logger.debug('Kullanıcı durumu güncellendi', {
      userId,
      isOnline,
    });
  } catch (error) {
    logger.error('Kullanıcı durumu güncellenirken hata oluştu', {
      error: (error as Error).message,
      userId,
      isOnline,
    });
  }
}

/**
 * Kullanıcının bağlantı sayısını döndürür
 * @param userId Kullanıcı ID
 * @returns Bağlantı sayısı
 */
export function getUserConnectionCount(userId: string): number {
  return activeConnections.get(userId)?.size || 0;
}

/**
 * Kullanıcının çevrimiçi olup olmadığını kontrol eder
 * @param userId Kullanıcı ID
 * @returns Çevrimiçi mi?
 */
export function isUserOnline(userId: string): boolean {
  return activeConnections.has(userId) && activeConnections.get(userId)!.size > 0;
}

/**
 * Tüm aktif kullanıcıların listesini döndürür
 * @returns Aktif kullanıcı ID'leri
 */
export function getOnlineUsers(): string[] {
  return Array.from(activeConnections.keys());
}

export default {
  configureSocketServer,
  getUserConnectionCount,
  isUserOnline,
  getOnlineUsers,
};
