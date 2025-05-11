/**
 * src/test-performance.ts
 * Performans izleme sistemi testi
 */
import express, { Request, Response, NextFunction } from 'express';
import { TokenPayload } from './config/jwt';
import * as Sentry from '@sentry/node';
import { logger } from './utils/logger';
import { setupUncaughtExceptionHandlers } from './middleware/errorHandler';
import * as sentryHandler from './middleware/sentryHandler';
import * as performance from './utils/performance';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './models/User';

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

// Performans izleme middleware'ini ekle
app.use(performance.performanceMiddleware());

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

// Veritabanına bağlan
async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGO_URI ||
      'mongodb+srv://atlas-sample-dataset-load-680408694495e57614ee6672:<IMKcxZTRUm0CfpDS>@fisk.0fi7bee.mongodb.net/?retryWrites=true&w=majority&appName=fisk';
    await mongoose.connect(mongoUri);
    logger.info('Veritabanına bağlandı');
  } catch (error) {
    logger.error('Veritabanı bağlantı hatası', { error: (error as Error).message });
    process.exit(1);
  }
}

// Test rotaları
app.get('/', (_req: Request, res: Response) => {
  logger.info('Ana sayfa isteği alındı');
  res.send('Performans izleme sistemi testi');
});

// Senkron performans testi
app.get('/performance/sync', (_req: Request, res: Response) => {
  logger.info('Senkron performans testi');

  const result = performance.measurePerformance(() => {
    // CPU yoğun bir işlem simülasyonu
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }
    return sum;
  }, 'CPU yoğun işlem');

  res.json({ result });
});

// Asenkron performans testi
app.get('/performance/async', async (_req: Request, res: Response) => {
  logger.info('Asenkron performans testi');

  const result = await performance.measurePerformanceAsync(async () => {
    // Asenkron işlem simülasyonu
    return new Promise<number>((resolve) => {
      setTimeout(() => {
        resolve(42);
      }, 500);
    });
  }, 'Asenkron işlem');

  res.json({ result });
});

// Veritabanı performans testi
app.get('/performance/database', async (_req: Request, res: Response) => {
  logger.info('Veritabanı performans testi');

  try {
    const users = await performance.measureDatabaseQuery('Tüm kullanıcıları getir', async () => {
      // Veritabanı sorgusu simülasyonu
      return User.find().limit(10);
    });

    res.json({ count: users.length });
  } catch (error) {
    logger.error('Veritabanı sorgu hatası', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

// Redis performans testi
app.get('/performance/redis', async (_req: Request, res: Response) => {
  logger.info('Redis performans testi');

  const result = await performance.measureRedisOperation('Veri getir', async () => {
    // Redis işlemi simülasyonu
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('redis-data');
      }, 100);
    });
  });

  res.json({ result });
});

// API çağrısı performans testi
app.get('/performance/api', async (_req: Request, res: Response) => {
  logger.info('API çağrısı performans testi');

  const result = await performance.measureApiCall('Harici API', async () => {
    // API çağrısı simülasyonu
    return new Promise<object>((resolve) => {
      setTimeout(() => {
        resolve({ data: 'api-response' });
      }, 300);
    });
  });

  res.json(result);
});

// Yavaş işlem testi
app.get('/performance/slow', async (_req: Request, res: Response) => {
  logger.info('Yavaş işlem testi');

  const result = await performance.measurePerformanceAsync(async () => {
    // Yavaş işlem simülasyonu
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('slow-operation-completed');
      }, 2000);
    });
  }, 'Yavaş işlem');

  res.json({ result });
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

// Ana fonksiyon
async function main() {
  try {
    // Veritabanına bağlan
    await connectToDatabase();

    // Sunucuyu başlat
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      logger.info(`Performans izleme test sunucusu çalışıyor: http://localhost:${PORT}`);

      // Test rotalarını göster
      logger.info('Test rotaları:');
      logger.info(`- http://localhost:${PORT}/ - Ana sayfa`);
      logger.info(`- http://localhost:${PORT}/performance/sync - Senkron performans testi`);
      logger.info(`- http://localhost:${PORT}/performance/async - Asenkron performans testi`);
      logger.info(`- http://localhost:${PORT}/performance/database - Veritabanı performans testi`);
      logger.info(`- http://localhost:${PORT}/performance/redis - Redis performans testi`);
      logger.info(`- http://localhost:${PORT}/performance/api - API çağrısı performans testi`);
      logger.info(`- http://localhost:${PORT}/performance/slow - Yavaş işlem testi`);
    });
  } catch (error) {
    logger.error('Uygulama başlatma hatası', { error: (error as Error).message });
    process.exit(1);
  }
}

// Uygulamayı başlat
main();
