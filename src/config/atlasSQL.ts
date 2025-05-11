/**
 * src/config/atlasSQL.ts
 * MongoDB Atlas SQL Federated Database Instance bağlantı yapılandırması
 */
import { MongoClient, MongoClientOptions } from 'mongodb';
import { logger } from '../utils/logger';
import { env } from './env';

// Atlas SQL bağlantı bilgileri
const ATLAS_SQL_URI =
  process.env.ATLAS_SQL_URI ||
  'mongodb://atlas-sql-6813a633f879840ff3b6c94c-4erc8v.a.query.mongodb.net/myVirtualDatabase?ssl=true&authSource=admin';
const ATLAS_SQL_USER = process.env.ATLAS_SQL_USER || process.env.MONGODB_USER;
const ATLAS_SQL_PASSWORD = process.env.ATLAS_SQL_PASSWORD || process.env.MONGODB_PASSWORD;
const ATLAS_SQL_DATABASE = process.env.ATLAS_SQL_DATABASE || 'myVirtualDatabase';
const ATLAS_SQL_ENABLED = process.env.ATLAS_SQL_ENABLED !== 'false';

// Güvenli bağlantı URL'si (şifre gizlenmiş)
const ATLAS_SQL_URI_SAFE = ATLAS_SQL_URI
  ? ATLAS_SQL_URI.replace(/:[^:@]+@/, ':****@')
  : 'mongodb://atlas-sql-****@a.query.mongodb.net/myVirtualDatabase?ssl=true&authSource=admin';

// MongoDB bağlantı URL'sini ve güvenli versiyonunu dışa aktar
export { ATLAS_SQL_URI, ATLAS_SQL_URI_SAFE };

// MongoDB istemci seçenekleri
export const atlasClientOptions: MongoClientOptions = {
  ssl: true,
  authSource: 'admin',
  auth: {
    username: ATLAS_SQL_USER,
    password: ATLAS_SQL_PASSWORD,
  },
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
  minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
  connectTimeoutMS: 30000, // 30 saniye
  socketTimeoutMS: 60000, // 60 saniye
};

/**
 * Atlas SQL bağlantı durumu
 */
export const atlasConnectionState = {
  isConnecting: false,
  lastConnectAttempt: 0,
  connectAttempts: 0,
  maxConnectAttempts: 5,
  reconnectTimeout: null as NodeJS.Timeout | null,
  isInitialized: false,
  client: null as MongoClient | null,
};

/**
 * Atlas SQL'e bağlanır
 * @param forceConnect - Bağlantıyı zorla yeniden kur
 * @returns MongoDB istemcisi
 */
export async function connectToAtlasSQL(forceConnect = false): Promise<MongoClient> {
  try {
    // Atlas SQL devre dışı bırakıldıysa, bağlantı kurmadan hata fırlat
    if (!ATLAS_SQL_ENABLED) {
      logger.info('Atlas SQL devre dışı bırakıldı, bağlantı kurulmayacak');
      throw new Error('Atlas SQL devre dışı bırakıldı');
    }

    // Eğer zaten bağlanıyorsa veya son bağlantı denemesinden bu yana 5 saniye geçmediyse bekle
    if (
      !forceConnect &&
      (atlasConnectionState.isConnecting ||
        (Date.now() - atlasConnectionState.lastConnectAttempt < 5000 &&
          atlasConnectionState.connectAttempts > 0))
    ) {
      logger.debug(
        'Atlas SQL bağlantısı zaten kuruluyor veya son denemeden bu yana çok az zaman geçti'
      );

      if (atlasConnectionState.client) {
        return atlasConnectionState.client;
      }

      throw new Error('Atlas SQL bağlantısı henüz kurulmadı');
    }

    // Bağlantı durumunu güncelle
    atlasConnectionState.isConnecting = true;
    atlasConnectionState.lastConnectAttempt = Date.now();
    atlasConnectionState.connectAttempts++;

    // Eğer bağlantı zaten kuruluysa ve forceConnect değilse, mevcut bağlantıyı döndür
    if (atlasConnectionState.client && !forceConnect) {
      logger.debug('Atlas SQL bağlantısı zaten kurulu');
      atlasConnectionState.isConnecting = false;
      return atlasConnectionState.client;
    }

    // Eğer bağlantı kuruluysa ve forceConnect true ise, önce bağlantıyı kapat
    if (atlasConnectionState.client && forceConnect) {
      logger.info('Atlas SQL bağlantısı yeniden kuruluyor...');
      await atlasConnectionState.client.close();
      atlasConnectionState.client = null;
    }

    // Atlas SQL'e bağlan
    const client = new MongoClient(ATLAS_SQL_URI, atlasClientOptions);
    await client.connect();

    // Bağlantıyı test et
    await client.db(ATLAS_SQL_DATABASE).command({ ping: 1 });

    // Bağlantı başarılı, istemciyi kaydet
    atlasConnectionState.client = client;

    logger.info('Atlas SQL bağlantısı başarılı', {
      uri: ATLAS_SQL_URI_SAFE,
      attempt: atlasConnectionState.connectAttempts,
      database: ATLAS_SQL_DATABASE,
    });

    // Bağlantı durumunu sıfırla
    atlasConnectionState.isConnecting = false;
    atlasConnectionState.connectAttempts = 0;

    return client;
  } catch (error) {
    atlasConnectionState.isConnecting = false;

    logger.error('Atlas SQL bağlantı hatası', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      attempt: atlasConnectionState.connectAttempts,
    });

    // Maksimum deneme sayısını aşmadıysa yeniden dene
    if (atlasConnectionState.connectAttempts < atlasConnectionState.maxConnectAttempts) {
      const retryDelay = Math.min(1000 * Math.pow(2, atlasConnectionState.connectAttempts), 30000); // Üstel geri çekilme, maksimum 30 saniye

      logger.info(
        `Atlas SQL bağlantısı ${retryDelay}ms sonra yeniden denenecek (Deneme: ${atlasConnectionState.connectAttempts}/${atlasConnectionState.maxConnectAttempts})`
      );

      // Önceki zamanlayıcıyı temizle
      if (atlasConnectionState.reconnectTimeout) {
        clearTimeout(atlasConnectionState.reconnectTimeout);
      }

      // Yeniden bağlanma zamanlayıcısını ayarla
      atlasConnectionState.reconnectTimeout = setTimeout(() => {
        connectToAtlasSQL().catch((err) => {
          logger.error('Atlas SQL yeniden bağlantı hatası', { error: err.message });
        });
      }, retryDelay);
    } else {
      logger.error(
        `Atlas SQL bağlantısı ${atlasConnectionState.maxConnectAttempts} deneme sonrasında başarısız oldu`
      );
    }

    throw error;
  }
}

/**
 * Atlas SQL bağlantısını kapatır
 */
export async function disconnectFromAtlasSQL(): Promise<void> {
  try {
    // Yeniden bağlanma zamanlayıcısını temizle
    if (atlasConnectionState.reconnectTimeout) {
      clearTimeout(atlasConnectionState.reconnectTimeout);
      atlasConnectionState.reconnectTimeout = null;
    }

    // Bağlantı durumunu sıfırla
    atlasConnectionState.isConnecting = false;
    atlasConnectionState.connectAttempts = 0;

    // Bağlantı açıksa kapat
    if (atlasConnectionState.client) {
      await atlasConnectionState.client.close();
      atlasConnectionState.client = null;
      logger.info('Atlas SQL bağlantısı kapatıldı');
    } else {
      logger.debug('Atlas SQL bağlantısı zaten kapalı');
    }
  } catch (error) {
    logger.error('Atlas SQL bağlantısını kapatma hatası', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

/**
 * Atlas SQL bağlantı durumunu kontrol eder
 * @returns Bağlantı durumu
 */
export function getAtlasSQLConnectionState(): string {
  return atlasConnectionState.client ? 'connected' : 'disconnected';
}

/**
 * Atlas SQL bağlantısının hazır olup olmadığını kontrol eder
 * @returns Bağlantı hazır mı
 */
export function isAtlasSQLReady(): boolean {
  return !!atlasConnectionState.client;
}

/**
 * Atlas SQL bağlantısını yeniden dener
 * @returns Bağlantı başarılı mı
 */
export async function retryAtlasSQLConnection(): Promise<boolean> {
  try {
    logger.info('Atlas SQL bağlantısı yeniden deneniyor...');

    // Bağlantıyı zorla yeniden kur
    await connectToAtlasSQL(true);

    logger.info('Atlas SQL bağlantısı başarıyla yeniden kuruldu');
    return true;
  } catch (error) {
    logger.error('Atlas SQL bağlantısı yeniden denenirken hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return false;
  }
}

export default {
  connectToAtlasSQL,
  disconnectFromAtlasSQL,
  ATLAS_SQL_URI,
  ATLAS_SQL_URI_SAFE,
  atlasClientOptions,
  atlasConnectionState,
  getAtlasSQLConnectionState,
  isAtlasSQLReady,
  retryAtlasSQLConnection,
};
