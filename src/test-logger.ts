/**
 * src/test-logger.ts
 * Loglama sistemini test etmek için örnek uygulama
 */
import dotenv from 'dotenv';
dotenv.config();

import { logger, logError, measurePerformance } from './utils/logger';
import * as sentryHandler from './middleware/sentryHandler';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Log dizini oluştur
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Express uygulaması oluştur
const app = express();

// Sentry'yi yapılandır ve başlat
sentryHandler.setupSentry(app);

// Test rotaları
app.get('/', (req: Request, res: Response) => {
  logger.info('Ana sayfa ziyaret edildi', {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.send(`
    <h1>Loglama Sistemi Test Uygulaması</h1>
    <ul>
      <li><a href="/log-test">Log Testi</a></li>
      <li><a href="/error-test">Hata Testi</a></li>
      <li><a href="/performance-test">Performans Testi</a></li>
      <li><a href="/sentry-test">Sentry Testi</a></li>
      <li><a href="/logs">Log Dosyaları</a></li>
    </ul>
  `);
});

// Log testi
app.get('/log-test', (req: Request, res: Response) => {
  logger.debug('Debug log test');
  logger.info('Info log test');
  logger.warn('Warning log test');
  logger.error('Error log test', { testError: new Error('Test error') });

  // Yapılandırılmış log
  logger.info('Structured log test', {
    requestId: uuidv4(),
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.send(`
    <h1>Log Testi Tamamlandı</h1>
    <p>Farklı seviyelerde loglar oluşturuldu.</p>
    <p><a href="/logs">Log Dosyalarını Görüntüle</a></p>
    <p><a href="/">Ana Sayfa</a></p>
  `);
});

// Hata testi
app.get('/error-test', (req: Request, res: Response) => {
  try {
    // Hata fırlat
    throw new Error('Test error');
  } catch (error) {
    // Hatayı logla
    logError(error as Error, 'Error test', {
      requestId: uuidv4(),
      ip: req.ip
    });

    res.send(`
      <h1>Hata Testi Tamamlandı</h1>
      <p>Bir hata oluşturuldu ve loglandı.</p>
      <p><a href="/logs">Log Dosyalarını Görüntüle</a></p>
      <p><a href="/">Ana Sayfa</a></p>
    `);
  }
});

// Performans testi
app.get('/performance-test', async (req: Request, res: Response) => {
  // Performans ölçümü
  const result = await measurePerformance(
    'sleep-test',
    async () => {
      // 2 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    {
      requestId: uuidv4(),
      ip: req.ip
    }
  );

  res.send(`
    <h1>Performans Testi Tamamlandı</h1>
    <p>Bir işlem performansı ölçüldü ve loglandı.</p>
    <p>Sonuç: ${JSON.stringify(result)}</p>
    <p><a href="/logs">Log Dosyalarını Görüntüle</a></p>
    <p><a href="/">Ana Sayfa</a></p>
  `);
});

// Sentry testi
// @ts-ignore
app.get('/sentry-test', ((req: Request, res: Response) => {
  // Sentry'nin yapılandırılıp yapılandırılmadığını kontrol et
  const sentryInitialized = process.env.SENTRY_DSN && isSentryInitialized();

  if (!sentryInitialized) {
    return res.send(`
      <h1>Sentry Testi Başarısız</h1>
      <p>Sentry yapılandırılmamış. SENTRY_DSN ortam değişkenini kontrol edin.</p>
      <p><a href="/">Ana Sayfa</a></p>
    `);
  }

  // Test hatası oluştur
  const testError = new Error('Test Sentry error');
  testError.name = 'SentryTestError';

  // Hatayı Sentry'ye bildir
  sentryHandler.sentryReportError(testError, {
    endpoint: '/sentry-test',
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  logger.info('Sentry test completed', {
    error: testError.message
  });

  res.send(`
    <h1>Sentry Testi Tamamlandı</h1>
    <p>Bir hata Sentry'ye bildirildi.</p>
    <p><a href="/logs">Log Dosyalarını Görüntüle</a></p>
    <p><a href="/">Ana Sayfa</a></p>
  `);
}));

// Log dosyalarını listele
app.get('/logs', (req: Request, res: Response) => {
  try {
    const logFiles = fs.readdirSync(LOG_DIR);

    let html = `
      <h1>Log Dosyaları</h1>
      <ul>
    `;

    logFiles.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      const fileSizeKB = Math.round(stats.size / 1024);

      html += `<li>${file} (${fileSizeKB} KB) - ${stats.mtime.toLocaleString()}</li>`;
    });

    html += `
      </ul>
      <p><a href="/">Ana Sayfa</a></p>
    `;

    res.send(html);
  } catch (error) {
    res.send(`
      <h1>Hata</h1>
      <p>Log dosyaları listelenirken bir hata oluştu: ${(error as Error).message}</p>
      <p><a href="/">Ana Sayfa</a></p>
    `);
  }
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Test uygulaması çalışıyor: http://localhost:${PORT}`);
});

// Yakalanmamış hataları işle
process.on('uncaughtException', (error) => {
  logger.error('Yakalanmamış istisna', { error });
  sentryHandler.sentryReportError(error, { context: 'Uncaught Exception' });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Yakalanmamış Promise reddi', { error });
  sentryHandler.sentryReportError(error, { context: 'Unhandled Rejection' });
  process.exit(1);
});

// Sentry'nin başlatılıp başlatılmadığını kontrol et
function isSentryInitialized(): boolean {
  try {
    const Sentry = require('@sentry/node');
    const hub = Sentry.getCurrentHub();
    return hub && hub.getClient() !== undefined;
  } catch (error) {
    return false;
  }
}
