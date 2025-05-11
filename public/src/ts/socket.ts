/**
 * public/src/ts/socket.ts
 * Socket.IO istemci bağlantısı ve yardımcı fonksiyonlar
 */

import io, { Socket as SocketIOClient } from 'socket.io-client';
import { AppSocket } from './types/socket';

// Socket.IO bağlantısını oluştur
const socket: AppSocket = io({
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
}) as AppSocket;

// Socket.IO bağlantı olaylarını dinle
socket.on('connect', () => {
  console.log('Socket.IO bağlantısı kuruldu:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO bağlantı hatası:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.IO bağlantısı kesildi:', reason);
});

socket.on('error', (error) => {
  console.error('Socket.IO hatası:', error);
});

/**
 * Promise tabanlı emit fonksiyonu
 * @param event - Olay adı
 * @param data - Olay verisi
 * @returns Promise
 */
export function emitWithAck<T = any>(event: string, data: any): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response: any) => {
      if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

// Socket.IO bağlantısını dışa aktar
export { socket };

// Socket.IO bağlantısını global olarak tanımla
(window as any).socket = socket;

// emitWithAck fonksiyonunu socket nesnesine ekle
socket.emitWithAck = emitWithAck;

export default socket;
