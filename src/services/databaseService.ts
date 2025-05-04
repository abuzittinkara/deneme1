/**
 * src/services/databaseService.ts
 * Veritabanı bağlantı ve yapılandırma servisi
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * MongoDB bağlantı seçenekleri
 */
const mongooseOptions: mongoose.ConnectOptions = {
  // Bağlantı havuzu boyutu
  maxPoolSize: 10,

  // Bağlantı zaman aşımı (ms)
  connectTimeoutMS: 10000,

  // Sorgu zaman aşımı (ms)
  socketTimeoutMS: 45000,

  // Otomatik yeniden bağlanma ayarları
  // autoReconnect: true, // Mongoose 6.x'te kaldırıldı

  // Yeniden bağlanma ayarları
  // Mongoose 6.x'te retryAttempts ve retryDelay yerine retryWrites kullanılıyor
  retryWrites: true,

  // Sorgu izleme (geliştirme modunda)
  // debug: env.NODE_ENV === 'development' // Mongoose 6.x'te ConnectOptions'da debug yok
};

/**
 * MongoDB'ye bağlanır
 *
 * @returns MongoDB bağlantısı
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    logger.info('MongoDB bağlantısı kuruluyor...');

    // Bağlantı URL'si kontrolü
    if (!env.MONGODB_URI) {
      throw new Error('MONGODB_URI çevre değişkeni tanımlanmamış');
    }

    // MongoDB'ye bağlan
    const connection = await mongoose.connect(env.MONGODB_URI, mongooseOptions);

    logger.info('MongoDB bağlantısı başarılı', {
      host: connection.connection.host,
      port: connection.connection.port,
      name: connection.connection.name
    });

    // Bağlantı olaylarını dinle
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB bağlantı hatası', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB bağlantısı kesildi');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB bağlantısı yeniden kuruldu');
    });

    // Uygulama kapatıldığında bağlantıyı kapat
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB bağlantısı kapatıldı (SIGINT)');
      process.exit(0);
    });

    return connection;
  } catch (error) {
    logger.error('MongoDB bağlantı hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    throw error;
  }
};

/**
 * Veritabanı bağlantısını kapatır
 */
export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB bağlantısı kapatıldı');
  } catch (error) {
    logger.error('MongoDB bağlantısı kapatılırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });

    throw error;
  }
};

/**
 * Veritabanı durumunu kontrol eder
 *
 * @returns Veritabanı durumu
 */
export const checkDBStatus = (): { connected: boolean; status: string } => {
  const state = mongoose.connection.readyState;

  switch (state) {
    case 0:
      return { connected: false, status: 'disconnected' };
    case 1:
      return { connected: true, status: 'connected' };
    case 2:
      return { connected: false, status: 'connecting' };
    case 3:
      return { connected: false, status: 'disconnecting' };
    default:
      return { connected: false, status: 'unknown' };
  }
};

/**
 * Veritabanı istatistiklerini getirir
 *
 * @returns Veritabanı istatistikleri
 */
export const getDBStats = async (): Promise<any> => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Veritabanı bağlantısı aktif değil');
    }

    const stats = await mongoose.connection.db.stats();

    return {
      dbName: mongoose.connection.name,
      collections: stats.collections,
      documents: stats.objects,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize
    };
  } catch (error) {
    logger.error('Veritabanı istatistikleri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });

    throw error;
  }
};

export default {
  connectDB,
  closeDB,
  checkDBStatus,
  getDBStats
};
