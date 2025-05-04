/**
 * src/server.ts
 * Sunucu başlatma dosyası
 */

// Ana uygulama dosyasını içe aktar
import app from './app';
import { logger } from './utils/logger';

/**
 * Sunucuyu başlatan fonksiyon
 * @returns Promise<void>
 */
export async function startServer(): Promise<void> {
  // Sunucu zaten app.ts içinde başlatıldığı için burada ek bir işlem yapmaya gerek yok
  logger.info('Sunucu başlatıldı.');
  return Promise.resolve();
}

export default app;
