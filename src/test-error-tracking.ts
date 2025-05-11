/**
 * src/test-error-tracking.ts
 * Hata izleme sistemi testi
 */
import express, { Request, Response, NextFunction } from 'express';
import { TokenPayload } from './config/jwt';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './utils/logger';
import { setupUncaughtExceptionHandlers } from './middleware/errorHandler';
import * as sentryHandler from './middleware/sentryHandler';
import * as dotenv from 'dotenv';

// Ortam değişkenlerini yükle
dotenv.config();

// Yakalanmamış hata işleyicilerini kur
setupUncaughtExceptionHandlers();

// Express uygulamasını oluştur
const app = express();

// Sentry'yi başlat
sentryHandler.setupSentry(app);

// Sentry istek işleyicisini ekle
app.use(sentryHandler.sentryRequestHandler);

// Sentry izleme işleyicisini ekle
app.use(sentryHandler.sentryTracingHandler);

// Kullanıcı bağlamını ekle
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Test için sahte kullanıcı
  (req as any).user = {
    id: '123456789',
    username: 'test-user',
    role: 'user',
    sub: '123456789',
  } as TokenPayload;
  next();
});

// Kullanıcı bağlamını Sentry'ye ekle
app.use(sentryHandler.sentryUserContext);

// Test rotaları
app.get('/', (_req: Request, res: Response) => {
  logger.info('Ana sayfa isteği alındı');
  res.send('Hata izleme sistemi testi');
});

// Operasyonel hata testi
app.get('/error/operational', (_req: Request, _res: Response, next: NextFunction) => {
  logger.info('Operasyonel hata testi');
  const error = new Error('Bu bir operasyonel hata testidir');
  (error as any).isOperational = true;
  (error as any).statusCode = 400;
  (error as any).code = 'TEST_OPERATIONAL_ERROR';
  next(error);
});

// Programlama hatası testi
app.get('/error/programming', (_req: Request, _res: Response) => {
  logger.info('Programlama hatası testi');
  throw new Error('Bu bir programlama hatası testidir');
});

// Yakalanmamış promise reddi testi
app.get('/error/unhandled-rejection', (_req: Request, res: Response) => {
  logger.info('Yakalanmamış promise reddi testi');

  // Bu promise'i işleme
  const promise = new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Bu bir yakalanmamış promise reddi testidir'));
    }, 100);
  });

  // Promise'i döndür ama yakala
  promise.catch((error) => {
    logger.error('Promise reddi yakalandı', { error });
    sentryHandler.sentryReportError(error);
    res.status(500).json({ error: error.message });
  });
});

// Sentry test rotası
app.get('/debug-sentry', function mainHandler(_req: Request, res: Response) {
  logger.info('Sentry test isteği alındı');

  // Breadcrumb ekle
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Sentry test breadcrumb',
    level: 'info',
  });

  // Etiket ekle
  Sentry.setTag('test-tag', 'test-value');

  // Bağlam ekle
  Sentry.setContext('test-context', {
    testKey: 'testValue',
    testNumber: 123,
    testBoolean: true,
  });

  // Hata fırlat
  throw new Error('Sentry test hatası!');
});

// Sentry hata işleyicisini ekle
app.use(sentryHandler.sentryErrorHandler);

// Genel hata işleyicisi
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Hata yakalandı', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    message: err.message,
    code: errorCode,
    timestamp: new Date().toISOString(),
  });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Hata izleme test sunucusu çalışıyor: http://localhost:${PORT}`);

  // Test rotalarını göster
  logger.info('Test rotaları:');
  logger.info(`- http://localhost:${PORT}/ - Ana sayfa`);
  logger.info(`- http://localhost:${PORT}/error/operational - Operasyonel hata testi`);
  logger.info(`- http://localhost:${PORT}/error/programming - Programlama hatası testi`);
  logger.info(
    `- http://localhost:${PORT}/error/unhandled-rejection - Yakalanmamış promise reddi testi`
  );
  logger.info(`- http://localhost:${PORT}/debug-sentry - Sentry test rotası`);
});
