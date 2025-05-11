/**
 * src/services/databaseService.ts
 * Merkezi veritabanı bağlantı ve yapılandırma servisi
 */
import mongoose from 'mongoose';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { createIndexes, optimizeDatabaseConnection } from '../utils/db-helpers';
import { AppError } from '../utils/errors';

/**
 * MongoDB bağlantı seçenekleri
 */
const mongooseOptions: mongoose.ConnectOptions = {
  // Bağlantı havuzu boyutu
  maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
  minPoolSize: env.MONGODB_MIN_POOL_SIZE,

  // Bağlantı zaman aşımı (ms)
  connectTimeoutMS: 30000,

  // Sorgu zaman aşımı (ms)
  socketTimeoutMS: 60000,

  // Yeniden bağlanma ayarları
  retryWrites: env.MONGODB_RETRY_WRITES,
  retryReads: true,

  // Sunucu seçim zaman aşımı
  serverSelectionTimeoutMS: 30000,

  // Heartbeat frekansı
  heartbeatFrequencyMS: 10000,

  // IPv4 kullan
  family: 4,

  // Aynı anda maksimum bağlantı kurma sayısı
  maxConnecting: 10,

  // Üretim ortamında daha sıkı ayarlar
  ...(env.isProduction
    ? {
        compressors: 'zlib', // Veri sıkıştırma
        zlibCompressionLevel: 6, // Sıkıştırma seviyesi (0-9)
      }
    : {}),
};

/**
 * MongoDB bağlantı durumu
 */
const connectionState = {
  isConnecting: false,
  lastConnectAttempt: 0,
  connectAttempts: 0,
  maxConnectAttempts: 5,
  reconnectTimeout: null as NodeJS.Timeout | null,
  isInitialized: false,
};

// MongoDB bağlantı olayları için EventEmitter
export const dbEvents = new EventEmitter();

/**
 * DatabaseService sınıfı
 * Veritabanı bağlantısı ve işlemleri için merkezi servis
 */
class DatabaseService {
  private uri: string;
  private uriSafe: string;
  private enabled: boolean;

  constructor() {
    // MongoDB bağlantı bilgileri
    this.uri = this.buildConnectionUri();
    this.uriSafe = this.uri
      ? this.uri.replace(/:[^:@]+@/, ':****@')
      : 'mongodb://localhost:27017/fisqos_dev';
    this.enabled = env.MONGODB_ENABLED !== 'false';

    // Bağlantı olaylarını dinle
    this.setupConnectionListeners();
  }

  /**
   * Bağlantı URI'sini oluşturur
   * @returns MongoDB bağlantı URI'si
   */
  private buildConnectionUri(): string {
    // Doğrudan URI belirtilmişse kullan
    if (env.MONGODB_URI) {
      return env.MONGODB_URI;
    }

    // Bileşenlerden URI oluştur
    if (env.MONGODB_USER && env.MONGODB_PASSWORD && env.MONGODB_HOST) {
      const options = 'retryWrites=true&w=majority&appName=Fisqos';
      return `mongodb+srv://${env.MONGODB_USER}:${env.MONGODB_PASSWORD}@${env.MONGODB_HOST}/${env.MONGODB_DATABASE || ''}?${options}`;
    }

    // Geliştirme ortamı için varsayılan bağlantı
    if (env.isDevelopment) {
      logger.info('Geliştirme ortamı için varsayılan MongoDB bağlantısı kullanılıyor');
      return 'mongodb://localhost:27017/fisqos_dev';
    }

    // Üretim ortamında bağlantı bilgileri eksikse hata fırlat
    if (env.isProduction) {
      throw new AppError(
        'MongoDB bağlantı bilgileri eksik. MONGODB_URI veya MONGODB_USER, MONGODB_PASSWORD ve MONGODB_HOST ortam değişkenlerini ayarlayın.',
        500,
        'DATABASE_CONFIG_ERROR'
      );
    }

    return 'mongodb://localhost:27017/fisqos_dev';
  }

  /**
   * Bağlantı olaylarını dinler
   */
  private setupConnectionListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB bağlantısı kuruldu');
      dbEvents.emit('connected');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB bağlantısı kesildi');
      dbEvents.emit('disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB bağlantı hatası', { error: err.message });
      dbEvents.emit('error', err);
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB bağlantısı yeniden kuruldu');
      dbEvents.emit('reconnected');
    });

    // Uygulama kapatıldığında bağlantıyı kapat
    process.on('SIGINT', async () => {
      await this.disconnect();
      logger.info('MongoDB bağlantısı kapatıldı (SIGINT)');
      process.exit(0);
    });
  }

  /**
   * MongoDB'ye bağlanır
   * @param forceConnect - Bağlantıyı zorla yeniden kur
   * @returns MongoDB bağlantısı
   */
  async connect(forceConnect = false): Promise<mongoose.Connection> {
    try {
      // MongoDB devre dışı bırakıldıysa, bağlantı kurmadan dön
      if (!this.enabled) {
        logger.info('MongoDB devre dışı bırakıldı, bağlantı kurulmayacak');
        return mongoose.connection;
      }

      // Zaten bağlıysa, yeni bağlantı kurma
      if (mongoose.connection.readyState === 1 && !forceConnect) {
        logger.debug('MongoDB zaten bağlı');
        return mongoose.connection;
      }

      // Zaten bağlantı kuruluyorsa, bekle
      if (connectionState.isConnecting && !forceConnect) {
        logger.debug(
          'MongoDB bağlantısı zaten kuruluyor veya son denemeden bu yana çok az zaman geçti'
        );
        return mongoose.connection;
      }

      // Bağlantı durumunu güncelle
      connectionState.isConnecting = true;
      connectionState.lastConnectAttempt = Date.now();
      connectionState.connectAttempts++;

      // Geliştirme modunda bağlantı kuruluyor mesajı
      if (env.isDevelopment) {
        logger.info('Geliştirme modunda MongoDB bağlantısı kuruluyor...');
      }

      // Veritabanı bağlantısını optimize et
      if (!connectionState.isInitialized) {
        optimizeDatabaseConnection();
        connectionState.isInitialized = true;
      }

      // Veritabanına bağlan
      await mongoose.connect(this.uri, mongooseOptions);

      logger.info('MongoDB bağlantısı başarılı', {
        uri: this.uriSafe,
        attempt: connectionState.connectAttempts,
        database: mongoose.connection.db?.databaseName || 'unknown',
      });

      // Bağlantı durumunu sıfırla
      connectionState.isConnecting = false;
      connectionState.connectAttempts = 0;

      // İndeksleri oluştur
      if (env.isProduction) {
        try {
          // Tüm modelleri al
          const models = Object.values(mongoose.models);
          await createIndexes(models);
          logger.info('MongoDB indeksleri başarıyla oluşturuldu');
        } catch (indexError) {
          logger.error('MongoDB indeksleri oluşturulurken hata oluştu', {
            error: (indexError as Error).message,
          });
          // İndeks hatası bağlantıyı engellemez
        }
      }

      return mongoose.connection;
    } catch (error) {
      connectionState.isConnecting = false;

      logger.error('MongoDB bağlantı hatası', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        attempt: connectionState.connectAttempts,
      });

      // Yeniden bağlanma denemesi
      if (connectionState.connectAttempts < connectionState.maxConnectAttempts) {
        const retryDelay = Math.min(1000 * Math.pow(2, connectionState.connectAttempts), 30000);
        logger.info(`MongoDB bağlantısı ${retryDelay}ms sonra yeniden denenecek`, {
          attempt: connectionState.connectAttempts,
          maxAttempts: connectionState.maxConnectAttempts,
        });

        // Önceki zamanlayıcıyı temizle
        if (connectionState.reconnectTimeout) {
          clearTimeout(connectionState.reconnectTimeout);
        }

        // Yeniden bağlanma zamanlayıcısı
        connectionState.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, retryDelay);
      } else {
        logger.error('MongoDB bağlantısı maksimum deneme sayısına ulaştı', {
          attempts: connectionState.connectAttempts,
          maxAttempts: connectionState.maxConnectAttempts,
        });

        // Hata olayını yayınla
        dbEvents.emit('connection_failed', error);
      }

      throw error;
    }
  }

  /**
   * Veritabanı bağlantısını kapatır
   */
  async disconnect(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info('MongoDB bağlantısı kapatıldı');
      }
    } catch (error) {
      logger.error('MongoDB bağlantısı kapatılırken hata oluştu', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  /**
   * Veritabanı bağlantısını yeniden dener
   */
  async retry(): Promise<mongoose.Connection> {
    // Bağlantı durumunu sıfırla
    connectionState.isConnecting = false;
    connectionState.connectAttempts = 0;

    // Yeniden bağlan
    return this.connect(true);
  }

  /**
   * Veritabanı bağlantı durumunu getirir
   * @returns Bağlantı durumu
   */
  getConnectionState(): string {
    const state = mongoose.connection.readyState;

    switch (state) {
      case 0:
        return 'disconnected';
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      default:
        return 'unknown';
    }
  }

  /**
   * Veritabanı bağlantısının hazır olup olmadığını kontrol eder
   * @returns Bağlantı hazır mı
   */
  isReady(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Veritabanı sağlık durumunu kontrol eder
   * @returns Sağlık durumu
   */
  async checkHealth(): Promise<any> {
    const startTime = Date.now();

    try {
      // Bağlantı durumunu kontrol et
      const status = this.getConnectionState();
      const isConnected = status === 'connected';

      if (!isConnected) {
        return {
          isConnected: false,
          status,
          responseTime: 0,
          collections: 0,
          error: 'Veritabanı bağlantısı kurulu değil',
        };
      }

      // Ping komutu ile bağlantıyı test et
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }

      // Koleksiyon sayısını al
      const collections = mongoose.connection.db
        ? await mongoose.connection.db.listCollections().toArray()
        : [];

      const responseTime = Date.now() - startTime;

      return {
        isConnected: true,
        status,
        responseTime,
        collections: collections.length,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isConnected: false,
        status: this.getConnectionState(),
        responseTime,
        collections: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Veritabanı istatistiklerini getirir
   * @returns Veritabanı istatistikleri
   */
  async getStats(): Promise<any> {
    try {
      if (mongoose.connection.readyState !== 1) {
        throw new AppError('Veritabanı bağlantısı aktif değil', 500, 'DATABASE_NOT_CONNECTED');
      }

      const stats = await mongoose.connection.db.stats();

      return {
        dbName: mongoose.connection.name,
        collections: stats.collections,
        documents: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
      };
    } catch (error) {
      logger.error('Veritabanı istatistikleri alınırken hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });

      throw error;
    }
  }

  /**
   * Koleksiyon nesnesini döndürür
   * @param collectionName - Koleksiyon adı
   * @returns Koleksiyon nesnesi
   */
  getCollection<T extends mongoose.Document>(
    collectionName: string
  ): mongoose.Collection<T> | null {
    if (mongoose.connection.readyState !== 1) {
      logger.error('Veritabanı bağlantısı kurulmadan koleksiyon erişimi denendi', {
        collection: collectionName,
      });
      return null;
    }

    return mongoose.connection.db.collection<T>(collectionName);
  }

  /**
   * Bağlantı URI'sini döndürür
   * @returns Bağlantı URI'si
   */
  getUri(): string {
    return this.uri;
  }

  /**
   * Güvenli bağlantı URI'sini döndürür (şifre gizlenmiş)
   * @returns Güvenli bağlantı URI'si
   */
  getUriSafe(): string {
    return this.uriSafe;
  }
}

// Singleton örneği
const databaseService = new DatabaseService();

export default databaseService;
