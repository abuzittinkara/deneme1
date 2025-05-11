/**
 * src/index.ts
 * Uygulama giriş noktası
 */
import { startServer } from './server';
import { logger } from './utils/logger';

/**
 * Ana fonksiyon
 */
async function main(): Promise<void> {
  try {
    // Sunucuyu başlat
    await startServer();
  } catch (error) {
    logger.error('Uygulama başlatma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Uygulamayı başlat
main();
