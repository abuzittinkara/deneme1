/**
 * src/socket/socketHandlers.ts
 * Socket.IO olay işleyicileri
 */
import { TypedSocket, TypedServer } from '../types/socket';
import { logger } from '../utils/logger';
import { registerCallHandlers } from './handlers/callHandlers';
import { registerMessageHandlers } from './handlers/messageHandlers';
import { registerPresenceHandlers } from './handlers/presenceHandlers';
import { CallManager } from '../services/callManager';

/**
 * Socket.IO olay işleyicilerini kaydet
 * @param io - Socket.IO sunucusu
 * @param dependencies - Bağımlılıklar
 */
export function registerSocketHandlers(
  io: TypedServer,
  dependencies: {
    callManager: CallManager;
    [key: string]: any;
  }
): void {
  // Bağlantı olayı
  io.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    logger.info('Socket.IO bağlantısı kuruldu', {
      socketId: socket.id,
      userId,
      username,
    });

    // Sesli/görüntülü görüşme olaylarını kaydet
    registerCallHandlers(socket, dependencies);

    // Mesaj olaylarını kaydet
    registerMessageHandlers(socket, dependencies);

    // Kullanıcı çevrimiçi durumu olaylarını kaydet
    registerPresenceHandlers(socket, dependencies);

    // Bağlantı kesilme olayı
    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO bağlantısı kesildi', {
        socketId: socket.id,
        userId,
        username,
        reason,
      });
    });

    // Hata olayı
    socket.on('error', (error) => {
      logger.error('Socket.IO hatası', {
        socketId: socket.id,
        userId,
        username,
        error: error instanceof Error ? error.message : error,
      });
    });
  });
}

export default {
  registerSocketHandlers,
};
