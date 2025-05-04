/**
 * src/config/database.ts
 * Veritabanı bağlantı yapılandırması
 */
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from './env';
import {
  monitorDatabaseConnection,
  createIndexes,
  optimizeDatabaseConnection
} from '../utils/db-helpers';

// MongoDB bağlantı bilgileri
const MONGODB_USER = env.MONGODB_USER;
const MONGODB_PASSWORD = env.MONGODB_PASSWORD;
const MONGODB_HOST = env.MONGODB_HOST;
const MONGODB_DATABASE = env.MONGODB_DATABASE || '';
const MONGODB_OPTIONS = 'retryWrites=true&w=majority&appName=Fisqos';

// MongoDB bağlantı URL'si
let MONGODB_URI = env.MONGODB_URI;

// Eğer doğrudan URI belirtilmemişse, bileşenlerden oluştur
if (!MONGODB_URI && MONGODB_USER && MONGODB_PASSWORD && MONGODB_HOST) {
  MONGODB_URI = `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE}?${MONGODB_OPTIONS}`;
} else if (!MONGODB_URI) {
  // Geliştirme ortamı için varsayılan bağlantı
  if (env.NODE_ENV === 'development') {
    MONGODB_URI = 'mongodb://localhost:27017/fisqos_dev';
    logger.info('Geliştirme ortamı için varsayılan MongoDB bağlantısı kullanılıyor');
  } else {
    // Üretim ortamında bağlantı bilgileri eksikse hata fırlat
    if (env.NODE_ENV === 'production') {
      throw new Error('MongoDB bağlantı bilgileri eksik. MONGODB_URI veya MONGODB_USER, MONGODB_PASSWORD ve MONGODB_HOST ortam değişkenlerini ayarlayın.');
    }
  }
}

// Güvenli bağlantı URL'si (şifre gizlenmiş)
const MONGODB_URI_SAFE = MONGODB_URI ? MONGODB_URI.replace(/:[^:@]+@/, ':****@') : 'mongodb://localhost:27017/fisqos_dev';

// MongoDB bağlantı URL'sini ve güvenli versiyonunu dışa aktar
export { MONGODB_URI, MONGODB_URI_SAFE };

// Mongoose seçenekleri
export const mongooseOptions: mongoose.ConnectOptions = {
  // useNewUrlParser ve useUnifiedTopology artık varsayılan olarak true
  autoIndex: process.env.NODE_ENV !== 'production', // Üretimde indeksleri otomatik oluşturma
  serverSelectionTimeoutMS: 30000, // 30 saniye
  socketTimeoutMS: 60000, // 60 saniye
  family: 4, // IPv4
  connectTimeoutMS: 30000, // 30 saniye
  heartbeatFrequencyMS: 10000, // 10 saniye
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10, // Üretimde daha fazla bağlantı
  minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1, // Minimum bağlantı sayısı
  // Yeni Mongoose 7.x+ özellikleri
  maxConnecting: 10, // Aynı anda maksimum bağlantı kurma sayısı
  retryWrites: true, // Yazma işlemlerini yeniden dene
  retryReads: true, // Okuma işlemlerini yeniden dene
  // Üretim ortamında daha sıkı ayarlar
  ...(process.env.NODE_ENV === 'production' ? {
    compressors: 'zlib', // Veri sıkıştırma
    zlibCompressionLevel: 6, // Sıkıştırma seviyesi (0-9)
  } : {})
};

/**
 * MongoDB bağlantı durumu
 */
export const connectionState = {
  isConnecting: false,
  lastConnectAttempt: 0,
  connectAttempts: 0,
  maxConnectAttempts: 5,
  reconnectTimeout: null as NodeJS.Timeout | null,
  isInitialized: false
};

/**
 * MongoDB'ye bağlanır
 * @param forceConnect - Bağlantıyı zorla yeniden kur
 * @returns MongoDB bağlantısı
 */
export async function connectToDatabase(forceConnect = false): Promise<mongoose.Connection> {
  try {
    // Eğer zaten bağlanıyorsa veya son bağlantı denemesinden bu yana 5 saniye geçmediyse bekle
    if (
      !forceConnect &&
      (connectionState.isConnecting ||
      (Date.now() - connectionState.lastConnectAttempt < 5000 && connectionState.connectAttempts > 0))
    ) {
      logger.debug('MongoDB bağlantısı zaten kuruluyor veya son denemeden bu yana çok az zaman geçti');
      return mongoose.connection;
    }

    // Bağlantı durumunu güncelle
    connectionState.isConnecting = true;
    connectionState.lastConnectAttempt = Date.now();
    connectionState.connectAttempts++;

    // Eğer bağlantı zaten kuruluysa ve forceConnect değilse, mevcut bağlantıyı döndür
    if (mongoose.connection.readyState === 1 && !forceConnect) {
      logger.debug('MongoDB bağlantısı zaten kurulu');
      connectionState.isConnecting = false;
      return mongoose.connection;
    }

    // Eğer bağlantı kuruluyorsa ve forceConnect true ise, önce bağlantıyı kapat
    if (mongoose.connection.readyState !== 0 && forceConnect) {
      logger.info('MongoDB bağlantısı yeniden kuruluyor...');
      await mongoose.connection.close();
    }

    // Veritabanı bağlantısını optimize et
    if (!connectionState.isInitialized) {
      optimizeDatabaseConnection();
      connectionState.isInitialized = true;
    }

    // Veritabanı bağlantısını izle
    monitorDatabaseConnection();

    // Veritabanına bağlan
    await mongoose.connect(MONGODB_URI as string, mongooseOptions);

    logger.info('MongoDB bağlantısı başarılı', {
      uri: MONGODB_URI_SAFE,
      attempt: connectionState.connectAttempts,
      database: mongoose.connection.db.databaseName
    });

    // Bağlantı durumunu sıfırla
    connectionState.isConnecting = false;
    connectionState.connectAttempts = 0;

    // İndeksleri oluştur
    if (env.NODE_ENV === 'production') {
      try {
        await createIndexes();
        logger.info('MongoDB indeksleri başarıyla oluşturuldu');
      } catch (indexError) {
        logger.error('MongoDB indeksleri oluşturulurken hata oluştu', {
          error: (indexError as Error).message
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
      attempt: connectionState.connectAttempts
    });

    // Maksimum deneme sayısını aşmadıysa yeniden dene
    if (connectionState.connectAttempts < connectionState.maxConnectAttempts) {
      const retryDelay = Math.min(1000 * Math.pow(2, connectionState.connectAttempts), 30000); // Üstel geri çekilme, maksimum 30 saniye

      logger.info(`MongoDB bağlantısı ${retryDelay}ms sonra yeniden denenecek (Deneme: ${connectionState.connectAttempts}/${connectionState.maxConnectAttempts})`);

      // Önceki zamanlayıcıyı temizle
      if (connectionState.reconnectTimeout) {
        clearTimeout(connectionState.reconnectTimeout);
      }

      // Yeniden bağlanma zamanlayıcısını ayarla
      connectionState.reconnectTimeout = setTimeout(() => {
        connectToDatabase().catch(err => {
          logger.error('MongoDB yeniden bağlantı hatası', { error: err.message });
        });
      }, retryDelay);
    } else {
      logger.error(`MongoDB bağlantısı ${connectionState.maxConnectAttempts} deneme sonrasında başarısız oldu`);
    }

    throw error;
  }
}

/**
 * MongoDB bağlantısını kapatır
 */
export async function disconnectFromDatabase(): Promise<void> {
  try {
    // Yeniden bağlanma zamanlayıcısını temizle
    if (connectionState.reconnectTimeout) {
      clearTimeout(connectionState.reconnectTimeout);
      connectionState.reconnectTimeout = null;
    }

    // Bağlantı durumunu sıfırla
    connectionState.isConnecting = false;
    connectionState.connectAttempts = 0;

    // Bağlantı açıksa kapat
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('MongoDB bağlantısı kapatıldı');
    } else {
      logger.debug('MongoDB bağlantısı zaten kapalı');
    }
  } catch (error) {
    logger.error('MongoDB bağlantısını kapatma hatası', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

// Bu olaylar app.ts içinde merkezi olarak işleniyor, burada tekrar işlemeye gerek yok
// Uygulama kapandığında bağlantıyı kapat işlemi gracefulShutdown fonksiyonu içinde yapılıyor

/**
 * Veritabanı bağlantı durumunu kontrol eder
 * @returns Bağlantı durumu
 */
export function getDatabaseConnectionState(): string {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Veritabanı bağlantısının hazır olup olmadığını kontrol eder
 * @returns Bağlantı hazır mı
 */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Veritabanı bağlantısını yeniden dener
 * @returns Bağlantı başarılı mı
 */
export async function retryDatabaseConnection(): Promise<boolean> {
  try {
    logger.info('Veritabanı bağlantısı yeniden deneniyor...');

    // Bağlantıyı zorla yeniden kur
    await connectToDatabase(true);

    logger.info('Veritabanı bağlantısı başarıyla yeniden kuruldu');
    return true;
  } catch (error) {
    logger.error('Veritabanı bağlantısı yeniden denenirken hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    return false;
  }
}

/**
 * Veritabanı bağlantı durumunu ve sağlığını kontrol eder
 * @returns Bağlantı sağlığı bilgileri
 */
export async function checkDatabaseHealth(): Promise<{
  isConnected: boolean;
  status: string;
  responseTime: number;
  collections: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Bağlantı durumunu kontrol et
    const status = getDatabaseConnectionState();
    const isConnected = status === 'connected';

    if (!isConnected) {
      return {
        isConnected: false,
        status,
        responseTime: 0,
        collections: 0,
        error: 'Veritabanı bağlantısı kurulu değil'
      };
    }

    // Ping komutu ile bağlantıyı test et
    await mongoose.connection.db.admin().ping();

    // Koleksiyon sayısını al
    const collections = await mongoose.connection.db.listCollections().toArray();

    const responseTime = Date.now() - startTime;

    return {
      isConnected: true,
      status,
      responseTime,
      collections: collections.length
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      isConnected: false,
      status: getDatabaseConnectionState(),
      responseTime,
      collections: 0,
      error: (error as Error).message
    };
  }
}

// MongoDB bağlantı durumu için EventEmitter
import { EventEmitter } from 'events';
export const mongoDbEvents = new EventEmitter();

// Bağlantı durumu değişikliklerini izle
mongoose.connection.on('connected', () => {
  logger.info('MongoDB bağlantısı kuruldu');
  // Bağlantı kurulduğunda bir olay yayınla
  mongoDbEvents.emit('connected');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB bağlantısı kesildi');
  // Bağlantı kesildiğinde bir olay yayınla
  mongoDbEvents.emit('disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB bağlantı hatası', { error: err.message });
  // Bağlantı hatası olduğunda bir olay yayınla
  mongoDbEvents.emit('error', err);
});

export default {
  connectToDatabase,
  disconnectFromDatabase,
  MONGODB_URI,
  MONGODB_URI_SAFE,
  mongooseOptions,
  connectionState,
  getDatabaseConnectionState,
  isDatabaseReady,
  retryDatabaseConnection,
  checkDatabaseHealth,
  mongoDbEvents
};
