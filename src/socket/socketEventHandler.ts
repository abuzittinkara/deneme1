/**
 * src/socket/socketEventHandler.ts
 * Socket.IO olay işleyici
 */
import { Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { UserDocument } from '../models/User';

// Socket yanıt tipi
export interface SocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// Socket olay işleyici tipi
export type SocketEventHandler<T = any, R = any> = (
  socket: AuthenticatedSocket,
  data: T,
  callback?: (response: SocketResponse<R>) => void
) => void | Promise<void>;

// Kimlik doğrulamalı socket
export interface AuthenticatedSocket extends Socket {
  user: UserDocument;
  currentRoom?: string;
  currentGroup?: string;
}

/**
 * Socket olay işleyici wrapper
 * @param handler Socket olay işleyicisi
 * @returns Hata yakalama ile sarılmış işleyici
 */
export function createSocketEventHandler(handler: SocketEventHandler): SocketEventHandler {
  return async (socket: AuthenticatedSocket, data: any, callback?: (response: SocketResponse) => void) => {
    try {
      // Başlangıç zamanını kaydet (performans izleme için)
      const startTime = Date.now();
      
      // İşleyiciyi çağır
      await handler(socket, data, callback);
      
      // Performans metriklerini logla
      const duration = Date.now() - startTime;
      if (duration > 100) { // 100ms'den uzun süren işlemleri logla
        logger.debug('Yavaş socket işlemi', {
          event: socket.eventNames().join(','),
          userId: socket.user?.id,
          duration: `${duration}ms`
        });
      }
    } catch (error) {
      // Hatayı logla
      logger.error('Socket olay işleme hatası', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        event: socket.eventNames().join(','),
        userId: socket.user?.id,
        data
      });
      
      // Hata yanıtı gönder
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: {
            message: (error as Error).message || 'Bir hata oluştu',
            code: (error as any).code || 'INTERNAL_ERROR'
          }
        });
      }
    }
  };
}

export default {
  createSocketEventHandler
};
