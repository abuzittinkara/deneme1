/**
 * src/test-logger-simple.ts
 * Loglama sistemini test etmek için basit uygulama
 */
import dotenv from 'dotenv';
dotenv.config();

import { logger, logError, measurePerformance } from './utils/logger';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Log dizini oluştur
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Test fonksiyonu
async function runTests() {
  console.log('Loglama Sistemi Test Uygulaması');
  console.log('--------------------------------');

  // Farklı log seviyelerini test et
  console.log('\n1. Farklı log seviyeleri testi:');
  logger.debug('Debug log test');
  logger.info('Info log test');
  logger.warn('Warning log test');
  logger.error('Error log test', { testError: new Error('Test error') });

  // Yapılandırılmış log testi
  console.log('\n2. Yapılandırılmış log testi:');
  const requestId = uuidv4();
  logger.info('Structured log test', {
    requestId,
    ip: '127.0.0.1',
    userAgent: 'Test Agent',
  });

  // Hata loglama testi
  console.log('\n3. Hata loglama testi:');
  try {
    throw new Error('Test error');
  } catch (error) {
    logError(error as Error, 'Error test', {
      requestId: uuidv4(),
      ip: '127.0.0.1',
    });
  }

  // Performans ölçümü testi
  console.log('\n4. Performans ölçümü testi:');
  const result = await measurePerformance(
    'sleep-test',
    async () => {
      // 2 saniye bekle
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { success: true };
    },
    {
      requestId: uuidv4(),
      ip: '127.0.0.1',
    }
  );
  console.log('Performans ölçümü sonucu:', result);

  // Log dosyalarını listele
  console.log('\n5. Log dosyaları:');
  try {
    const logFiles = fs.readdirSync(LOG_DIR);

    if (logFiles.length === 0) {
      console.log('Henüz log dosyası oluşturulmamış.');
    } else {
      logFiles.forEach((file) => {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);
        const fileSizeKB = Math.round(stats.size / 1024);

        console.log(`- ${file} (${fileSizeKB} KB) - ${stats.mtime.toLocaleString()}`);
      });
    }
  } catch (error) {
    console.error('Log dosyaları listelenirken hata:', (error as Error).message);
  }

  console.log('\nTest tamamlandı. Log dosyalarını kontrol edin:', LOG_DIR);
}

// Testleri çalıştır
runTests().catch((error) => {
  console.error('Test sırasında hata:', error);
  process.exit(1);
});
