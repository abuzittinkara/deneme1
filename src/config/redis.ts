/**
 * src/config/redis.ts
 * Gelişmiş Redis yapılandırması ve bağlantı yönetimi
 */
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// Redis bağlantı durumu için enum
export enum RedisConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  READY = 'ready'
}

// Redis bağlantı yöneticisi için interface
export interface RedisConnectionManager {
  getClient(): Redis;
  getState(): RedisConnectionState;
  isHealthy(): boolean;
  onStateChange(listener: (state: RedisConnectionState) => void): void;
}

class RedisManager extends EventEmitter implements RedisConnectionManager {
  private client: Redis;
  private mockClient: any;
  private state: RedisConnectionState = RedisConnectionState.CONNECTING;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly healthCheckIntervalMs = 30000; // 30 saniye

  constructor() {
    super();

    // Redis bağlantı seçenekleri
    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'fisqos:',

      // Yeniden bağlanma stratejisi
      retryStrategy: (times: number) => {
        this.reconnectAttempts = times;

        if (times > this.maxReconnectAttempts) {
          // Maksimum yeniden bağlanma denemesi aşıldı, sahte istemciye geç
          logger.warn(`Redis maksimum yeniden bağlanma denemesi aşıldı (${times}/${this.maxReconnectAttempts})`);
          this.switchToMockClient();
          return null; // Yeniden bağlanmayı durdur
        }

        // Üstel geri çekilme stratejisi (exponential backoff)
        const delay = Math.min(Math.pow(2, times) * 100, 5000); // Maksimum 5 saniye bekle
        logger.info(`Redis bağlantısı yeniden deneniyor... (${times}/${this.maxReconnectAttempts}. deneme, ${delay}ms sonra)`);
        return delay;
      },

      // Hata durumunda yeniden bağlanma stratejisi
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];

        for (const errorType of targetErrors) {
          if (err.message.includes(errorType)) {
            logger.warn(`Redis hatası nedeniyle yeniden bağlanılıyor: ${errorType}`);
            return true;
          }
        }

        return false;
      },

      // Bağlantı zaman aşımı
      connectTimeout: 10000, // 10 saniye

      // İstek başına maksimum yeniden deneme sayısı
      maxRetriesPerRequest: 3,

      // Komut zaman aşımı
      commandTimeout: 5000, // 5 saniye

      // Otomatik pipeline etkinleştirme
      enableAutoPipelining: true,

      // Bağlantı olayları
      enableOfflineQueue: true,

      // TLS desteği (opsiyonel)
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined
    };

    // Sahte istemci oluştur
    this.mockClient = this.createMockRedisClient();

    // Geliştirme modunda veya Redis devre dışı bırakıldığında doğrudan sahte istemciyi kullan
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false') {
      logger.info('Geliştirme/test modunda Redis devre dışı bırakıldı, sahte istemci kullanılıyor');
      this.switchToMockClient();
    } else {
      // Redis bağlantısını oluştur
      try {
        this.client = new Redis(redisOptions);
        this.setupEventListeners();
        this.startHealthCheck();
      } catch (error) {
        logger.error('Redis bağlantısı oluşturulurken hata:', { error: (error as Error).message });
        this.switchToMockClient();
      }
    }
  }

  /**
   * Redis istemcisini döndürür
   */
  public getClient(): Redis {
    return this.client || this.mockClient;
  }

  /**
   * Mevcut bağlantı durumunu döndürür
   */
  public getState(): RedisConnectionState {
    return this.state;
  }

  /**
   * Redis bağlantısının sağlıklı olup olmadığını kontrol eder
   */
  public isHealthy(): boolean {
    return this.state === RedisConnectionState.CONNECTED ||
           this.state === RedisConnectionState.READY;
  }

  /**
   * Durum değişikliği olaylarını dinlemek için
   */
  public onStateChange(listener: (state: RedisConnectionState) => void): void {
    this.on('stateChange', listener);
  }

  /**
   * Redis bağlantı olaylarını dinle
   */
  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.updateState(RedisConnectionState.CONNECTED);
      logger.info('Redis bağlantısı kuruldu');
    });

    this.client.on('ready', () => {
      this.updateState(RedisConnectionState.READY);
      this.reconnectAttempts = 0;
      logger.info('Redis kullanıma hazır');
    });

    this.client.on('error', (err) => {
      this.updateState(RedisConnectionState.ERROR);
      logger.error('Redis bağlantı hatası', { error: err.message });
    });

    this.client.on('close', () => {
      this.updateState(RedisConnectionState.DISCONNECTED);
      logger.warn('Redis bağlantısı kapatıldı');
    });

    this.client.on('reconnecting', () => {
      this.updateState(RedisConnectionState.RECONNECTING);
      logger.info('Redis yeniden bağlanıyor');
    });

    this.client.on('end', () => {
      this.updateState(RedisConnectionState.DISCONNECTED);
      logger.warn('Redis bağlantısı sonlandırıldı');
    });
  }

  /**
   * Durum değişikliğini güncelle ve olayı yayınla
   */
  private updateState(newState: RedisConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChange', newState);
    }
  }

  /**
   * Periyodik sağlık kontrolü başlat
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.client && !this.client.status.includes('close')) {
          await this.client.ping();

          if (this.state !== RedisConnectionState.READY) {
            this.updateState(RedisConnectionState.READY);
            logger.info('Redis bağlantısı sağlıklı');
          }
        }
      } catch (error) {
        logger.warn('Redis sağlık kontrolü başarısız:', { error: (error as Error).message });

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          this.switchToMockClient();
        }
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Sahte Redis istemcisine geç
   */
  private switchToMockClient(): void {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false') {
      logger.info('Geliştirme/test modunda sahte Redis istemcisi kullanılıyor');
    } else {
      logger.warn('Redis bağlantısı kurulamadı, sahte istemci kullanılıyor');
    }
    this.client = this.mockClient as unknown as Redis;
    this.updateState(RedisConnectionState.DISCONNECTED);
  }

  /**
   * Redis bağlantısını devre dışı bırakmak için sahte bir istemci oluştur
   * Bellek içi basit bir önbellek kullanır
   */
  private createMockRedisClient() {
    // Bellek içi önbellek
    const memoryCache: Record<string, { value: string, expiry: number | null }> = {};
    const hashCache: Record<string, Record<string, string>> = {};
    const listCache: Record<string, string[]> = {};
    const setCache: Record<string, Set<string>> = {};

    // Yardımcı fonksiyonlar
    const isExpired = (key: string): boolean => {
      const item = memoryCache[key];
      if (!item) return true;
      if (item.expiry === null) return false;
      return Date.now() > item.expiry;
    };

    const cleanExpired = (): void => {
      const now = Date.now();
      Object.keys(memoryCache).forEach(key => {
        const item = memoryCache[key];
        if (item.expiry !== null && now > item.expiry) {
          delete memoryCache[key];
        }
      });
    };

    // Periyodik temizleme
    setInterval(cleanExpired, 60000); // Her dakika temizle

    const mockClient = {
      // Temel metodlar
      ping: async () => 'PONG',

      // String işlemleri
      set: async (key: string, value: string, exMode?: string, exValue?: number) => {
        let expiry: number | null = null;

        if (exMode === 'EX' && exValue) {
          expiry = Date.now() + (exValue * 1000);
        }

        memoryCache[key] = { value, expiry };
        return 'OK';
      },

      get: async (key: string): Promise<string | null> => {
        if (!memoryCache[key] || isExpired(key)) {
          return null;
        }
        return memoryCache[key].value;
      },

      del: async (...keys: string[]): Promise<number> => {
        let count = 0;
        keys.forEach(key => {
          if (memoryCache[key]) {
            delete memoryCache[key];
            count++;
          }
        });
        return count;
      },

      expire: async (key: string, seconds: number): Promise<number> => {
        if (!memoryCache[key]) return 0;

        memoryCache[key].expiry = Date.now() + (seconds * 1000);
        return 1;
      },

      ttl: async (key: string): Promise<number> => {
        if (!memoryCache[key]) return -2; // Anahtar yok
        if (memoryCache[key].expiry === null) return -1; // Süresiz

        const ttl = Math.ceil((memoryCache[key].expiry! - Date.now()) / 1000);
        return ttl > 0 ? ttl : -2;
      },

      exists: async (key: string): Promise<number> => {
        return (memoryCache[key] && !isExpired(key)) ? 1 : 0;
      },

      // Sayaç işlemleri
      incrby: async (key: string, increment: number): Promise<number> => {
        if (!memoryCache[key] || isExpired(key)) {
          memoryCache[key] = { value: '0', expiry: null };
        }

        const currentValue = parseInt(memoryCache[key].value, 10) || 0;
        const newValue = currentValue + increment;
        memoryCache[key].value = newValue.toString();

        return newValue;
      },

      // Hash işlemleri
      hset: async (key: string, field: string, value: string): Promise<number> => {
        if (!hashCache[key]) {
          hashCache[key] = {};
        }

        const isNew = hashCache[key][field] === undefined;
        hashCache[key][field] = value;

        return isNew ? 1 : 0;
      },

      hget: async (key: string, field: string): Promise<string | null> => {
        if (!hashCache[key] || hashCache[key][field] === undefined) {
          return null;
        }

        return hashCache[key][field];
      },

      hgetall: async (key: string): Promise<Record<string, string>> => {
        return hashCache[key] || {};
      },

      hdel: async (key: string, ...fields: string[]): Promise<number> => {
        if (!hashCache[key]) return 0;

        let count = 0;
        fields.forEach(field => {
          if (hashCache[key][field] !== undefined) {
            delete hashCache[key][field];
            count++;
          }
        });

        return count;
      },

      // Liste işlemleri
      lpush: async (key: string, ...values: string[]): Promise<number> => {
        if (!listCache[key]) {
          listCache[key] = [];
        }

        listCache[key].unshift(...values);
        return listCache[key].length;
      },

      rpush: async (key: string, ...values: string[]): Promise<number> => {
        if (!listCache[key]) {
          listCache[key] = [];
        }

        listCache[key].push(...values);
        return listCache[key].length;
      },

      lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
        if (!listCache[key]) return [];

        const list = listCache[key];
        const end = stop < 0 ? list.length + stop + 1 : stop + 1;

        return list.slice(start, end);
      },

      // Set işlemleri
      sadd: async (key: string, ...members: string[]): Promise<number> => {
        if (!setCache[key]) {
          setCache[key] = new Set();
        }

        let count = 0;
        members.forEach(member => {
          if (!setCache[key].has(member)) {
            setCache[key].add(member);
            count++;
          }
        });

        return count;
      },

      smembers: async (key: string): Promise<string[]> => {
        if (!setCache[key]) return [];

        return Array.from(setCache[key]);
      },

      srem: async (key: string, ...members: string[]): Promise<number> => {
        if (!setCache[key]) return 0;

        let count = 0;
        members.forEach(member => {
          if (setCache[key].has(member)) {
            setCache[key].delete(member);
            count++;
          }
        });

        return count;
      },

      // Diğer işlemler
      publish: async () => 0,
      info: async () => 'redis_version:mock',
      duplicate: () => mockClient,
      status: 'ready',

      // Anahtar deseni ile eşleşen anahtarları bulma
      keys: async (pattern: string): Promise<string[]> => {
        const escapeRegExp = (string: string) => {
          return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // * karakterini .* ile değiştir
        const regexPattern = new RegExp('^' + escapeRegExp(pattern).replace(/\\\*/g, '.*') + '$');

        return Object.keys(memoryCache).filter(key => regexPattern.test(key));
      },

      // Tüm verileri temizleme
      flushall: async () => {
        Object.keys(memoryCache).forEach(key => delete memoryCache[key]);
        Object.keys(hashCache).forEach(key => delete hashCache[key]);
        Object.keys(listCache).forEach(key => delete listCache[key]);
        Object.keys(setCache).forEach(key => delete setCache[key]);
        return 'OK';
      },

      // Event emitter metodları
      on: () => mockClient,
      once: () => mockClient,
      emit: () => true,
      subscribe: (channel: string, callback: Function) => callback(null, 1),
      quit: async () => 'OK'
    };

    return mockClient;
  }

  /**
   * Kaynakları temizle
   */
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client && this.client !== this.mockClient) {
      try {
        await this.client.quit();
      } catch (error) {
        logger.error('Redis bağlantısı kapatılırken hata:', { error: (error as Error).message });
      }
    }

    this.updateState(RedisConnectionState.DISCONNECTED);
  }
}

// Redis yöneticisi örneği oluştur
const redisManager = new RedisManager();

// Redis istemcisini dışa aktar
export const redisClient = redisManager.getClient();

// Redis yöneticisini dışa aktar
export const redisConnectionManager = redisManager;

/**
 * Redis'e veri kaydetme yardımcı fonksiyonu
 * @param key - Anahtar
 * @param value - Değer
 * @param ttl - Yaşam süresi (saniye)
 */
export async function setCache(key: string, value: any, ttl?: number): Promise<string> {
  try {
    const serializedValue = JSON.stringify(value);

    if (ttl) {
      return await redisClient.set(key, serializedValue, 'EX', ttl);
    } else {
      return await redisClient.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Redis set hatası', { error: (error as Error).message, key });
    throw error;
  }
}

/**
 * Redis'te bir anahtarın var olup olmadığını kontrol eder
 * @param key - Anahtar
 * @returns Anahtar var mı
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Redis exists hatası', { error: (error as Error).message, key });
    return false;
  }
}

/**
 * Redis'te bir anahtarın TTL süresini getirir
 * @param key - Anahtar
 * @returns TTL süresi (saniye)
 */
export async function getTTL(key: string): Promise<number> {
  try {
    return await redisClient.ttl(key);
  } catch (error) {
    logger.error('Redis TTL hatası', { error: (error as Error).message, key });
    return -2; // Anahtar bulunamadı
  }
}

/**
 * Redis'e hash veri kaydetme yardımcı fonksiyonu
 * @param hashKey - Hash anahtarı
 * @param field - Alan
 * @param value - Değer
 * @param ttl - Yaşam süresi (saniye)
 */
export async function setHashCache(hashKey: string, field: string, value: any, ttl?: number): Promise<number> {
  try {
    const serializedValue = JSON.stringify(value);
    const result = await redisClient.hset(hashKey, field, serializedValue);

    if (ttl) {
      await redisClient.expire(hashKey, ttl);
    }

    return result;
  } catch (error) {
    logger.error('Redis hash set hatası', { error: (error as Error).message, hashKey, field });
    throw error;
  }
}

/**
 * Redis'ten hash veri getirme yardımcı fonksiyonu
 * @param hashKey - Hash anahtarı
 * @param field - Alan
 */
export async function getHashCache<T = any>(hashKey: string, field: string): Promise<T | null> {
  try {
    const value = await redisClient.hget(hashKey, field);

    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Redis hash get hatası', { error: (error as Error).message, hashKey, field });
    return null;
  }
}

/**
 * Redis'ten tüm hash veriyi getirme yardımcı fonksiyonu
 * @param hashKey - Hash anahtarı
 * @param field - Alan
 */
export async function getAllHashCache<T = any>(hashKey: string, field: string): Promise<T | null> {
  try {
    const value = await redisClient.hget(hashKey, field);

    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Redis hash get hatası', { error: (error as Error).message, hashKey, field });
    return null;
  }
}

/**
 * Redis'ten veri getirme yardımcı fonksiyonu
 * @param key - Anahtar
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const value = await redisClient.get(key);

    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Redis get hatası', { error: (error as Error).message, key });
    return null;
  }
}

/**
 * Redis'ten veri silme yardımcı fonksiyonu
 * @param key - Anahtar
 */
export async function deleteCache(key: string): Promise<number> {
  try {
    return await redisClient.del(key);
  } catch (error) {
    logger.error('Redis delete hatası', { error: (error as Error).message, key });
    throw error;
  }
}

/**
 * Redis'te bir sayaç artırma yardımcı fonksiyonu
 * @param key - Anahtar
 * @param increment - Artış miktarı
 * @param ttl - Yaşam süresi (saniye)
 */
export async function incrementCache(key: string, increment = 1, ttl?: number): Promise<number> {
  try {
    const value = await redisClient.incrby(key, increment);

    if (ttl) {
      await redisClient.expire(key, ttl);
    }

    return value;
  } catch (error) {
    logger.error('Redis increment hatası', { error: (error as Error).message, key });
    throw error;
  }
}

/**
 * Önbellekli veri getirme yardımcı fonksiyonu
 * Redis hatası durumunda doğrudan veri kaynağından veriyi getirir
 * @param key - Önbellek anahtarı
 * @param fetchFunction - Veriyi getiren fonksiyon
 * @param options - Önbellek seçenekleri
 * @returns Veri
 */
export async function getCachedData<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: {
    ttl?: number;
    forceRefresh?: boolean;
    logHit?: boolean;
    logMiss?: boolean;
    staleWhileRevalidate?: boolean;
  } = {}
): Promise<T> {
  // Varsayılan seçenekler
  const {
    ttl = 3600,
    forceRefresh = false,
    logHit = false,
    logMiss = false,
    staleWhileRevalidate = false
  } = options;

  // GELİŞTİRME/TEST MODU: NODE_ENV development veya test ise veya Redis devre dışı bırakıldığında doğrudan veri kaynağından getir
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false') {
    try {
      return await fetchFunction();
    } catch (error) {
      logger.error(`Veri getirme hatası (geliştirme/test modu): ${(error as Error).message}`);
      throw error;
    }
  }

  // Önbelleği yenileme isteği varsa doğrudan veri kaynağından getir
  if (forceRefresh) {
    try {
      const data = await fetchFunction();

      // Veriyi Redis'e kaydetmeyi dene
      if (redisConnectionManager.isHealthy()) {
        await setCache(key, data, ttl);
      }

      return data;
    } catch (error) {
      logger.error(`Veri yenileme hatası: ${(error as Error).message}`);
      throw error;
    }
  }

  try {
    // Önce Redis'ten veriyi almayı dene
    if (redisConnectionManager.isHealthy()) {
      const cachedData = await getCache<T>(key);

      if (cachedData) {
        // Önbellek isabet (cache hit)
        if (logHit) {
          logger.debug(`Önbellek isabet: ${key}`);
        }

        // Stale-while-revalidate stratejisi
        if (staleWhileRevalidate) {
          // Önbellek süresini kontrol et
          const remainingTtl = await getTTL(key);

          // Eğer süre yarısından az kaldıysa, arka planda yenile
          if (remainingTtl > 0 && remainingTtl < ttl / 2) {
            // Arka planda veriyi yenile
            fetchFunction().then(newData => {
              setCache(key, newData, ttl).catch(error => {
                logger.warn(`Arka plan önbellek yenileme hatası: ${(error as Error).message}`);
              });
            }).catch(error => {
              logger.warn(`Arka plan veri getirme hatası: ${(error as Error).message}`);
            });
          }
        }

        return cachedData;
      }

      if (logMiss) {
        logger.debug(`Önbellek ıskalama: ${key}`);
      }
    }
  } catch (error) {
    logger.warn(`Redis önbellek okuma hatası: ${(error as Error).message}`);
    // Redis hatası durumunda sessizce devam et
  }

  // Redis'ten veri alınamazsa veritabanından getir
  try {
    const data = await fetchFunction();

    // Veriyi Redis'e kaydetmeyi dene
    if (redisConnectionManager.isHealthy()) {
      await setCache(key, data, ttl);
    }

    return data;
  } catch (error) {
    logger.error(`Veri getirme hatası: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Önbellekli veri getirme yardımcı fonksiyonu (basitleştirilmiş)
 * @param key - Önbellek anahtarı
 * @param fetchFunction - Veriyi getiren fonksiyon
 * @param ttl - Önbellek süresi (saniye)
 * @returns Veri
 */
export async function getCachedDataSimple<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  ttl = 3600
): Promise<T> {
  return getCachedData(key, fetchFunction, { ttl });
}
