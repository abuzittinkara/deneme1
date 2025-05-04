/**
 * SFU (Selective Forwarding Unit) modülü için tip tanımlaması
 */
declare module '../sfu' {
  /**
   * SFU'yu başlatır
   * @param io - Socket.IO sunucusu
   * @param redisClient - Redis istemcisi
   */
  export function initSfu(io: any, redisClient: any): void;

  /**
   * SFU'yu durdurur
   */
  export function stopSfu(): void;

  /**
   * SFU durumunu döndürür
   * @returns SFU durumu
   */
  export function getSfuStatus(): {
    isRunning: boolean;
    workers: number;
    rooms: number;
    peers: number;
  };
}
