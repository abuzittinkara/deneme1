/**
 * src/utils/cacheManager.ts
 * Önbellek yönetimi
 */
import { logger } from './logger';
import NodeCache from 'node-cache';

// Önbellek öğesi arayüzü
interface CacheItem<T> {
  value: T;
  expiry: number;
}

/**
 * LRU (Least Recently Used) Önbellek sınıfı
 */
export class LRUCache<T = any> {
  private capacity: number;
  private ttl: number;
  private cache: Map<string, CacheItem<T>>;
  private keys: string[];
  private cleanupInterval: NodeJS.Timeout;
  private hits: number = 0;
  private misses: number = 0;

  /**
   * LRU Önbellek oluşturur
   * @param capacity - Maksimum önbellek kapasitesi
   * @param ttl - Önbellek öğelerinin yaşam süresi (milisaniye)
   */
  constructor(capacity = 1000, ttl = 3600000) {
    this.capacity = capacity;
    this.ttl = ttl;
    this.cache = new Map<string, CacheItem<T>>();
    this.keys = [];

    // Periyodik temizleme
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 dakikada bir

    logger.info('LRU Önbellek oluşturuldu', { capacity, ttl });
  }

  /**
   * Önbellekten değer getirir
   * @param key - Önbellek anahtarı
   * @returns Önbellekteki değer veya undefined
   */
  get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }

    const item = this.cache.get(key)!;

    // TTL kontrolü
    if (Date.now() > item.expiry) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Anahtarı en sona taşı (en son kullanılan)
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);

    this.hits++;
    return item.value;
  }

  /**
   * Önbelleğe değer ekler
   * @param key - Önbellek anahtarı
   * @param value - Saklanacak değer
   * @param customTtl - Özel TTL değeri (milisaniye)
   */
  set(key: string, value: T, customTtl?: number): void {
    // Kapasite kontrolü
    if (this.keys.length >= this.capacity && !this.cache.has(key)) {
      // En eski anahtarı sil (en az kullanılan)
      const oldestKey = this.keys.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('Önbellekten eski öğe silindi', { key: oldestKey });
      }
    }

    // Eğer anahtar zaten varsa, listeden çıkar
    if (this.cache.has(key)) {
      this.keys = this.keys.filter(k => k !== key);
    }

    // Yeni değeri ekle
    this.cache.set(key, {
      value,
      expiry: Date.now() + (customTtl || this.ttl)
    });

    // Anahtarı en sona ekle (en son kullanılan)
    this.keys.push(key);

    logger.debug('Önbelleğe öğe eklendi', { key });
  }

  /**
   * Önbellekten değer siler
   * @param key - Önbellek anahtarı
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.keys = this.keys.filter(k => k !== key);

    logger.debug('Önbellekten öğe silindi', { key });
  }

  /**
   * Önbelleği temizler
   */
  clear(): void {
    this.cache.clear();
    this.keys = [];
    this.hits = 0;
    this.misses = 0;

    logger.info('Önbellek temizlendi');
  }

  /**
   * Süresi dolmuş öğeleri temizler
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Süresi dolmuş anahtarları bul
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }

    // Süresi dolmuş anahtarları sil
    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.info('Önbellekten süresi dolmuş öğeler temizlendi', { count: expiredKeys.length });
    }
  }

  /**
   * Önbellek istatistiklerini döndürür
   * @returns Önbellek istatistikleri
   */
  getStats(): Record<string, any> {
    const hitRate = this.hits + this.misses > 0
      ? this.hits / (this.hits + this.misses)
      : 0;

    return {
      size: this.cache.size,
      capacity: this.capacity,
      ttl: this.ttl,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate,
      hitRateFormatted: `${(hitRate * 100).toFixed(2)}%`,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Önbelleği kapatır
   */
  close(): void {
    clearInterval(this.cleanupInterval);
    this.clear();

    logger.info('Önbellek kapatıldı');
  }

  /**
   * Önbellek boyutunu döndürür
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Önbellek kapasitesini döndürür
   */
  get maxSize(): number {
    return this.capacity;
  }

  /**
   * Önbellek istatistiklerini döndürür
   */
  get stats(): { hits: number; misses: number; hitRate: number } {
    const hitRate = this.hits + this.misses > 0
      ? this.hits / (this.hits + this.misses)
      : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }
}

/**
 * Önbellek yapılandırması
 */
const CACHE_CONFIG = {
  // Kullanıcı önbelleği
  user: {
    max: 500, // Maksimum 500 kullanıcı
    ttl: 15 * 60 * 1000, // 15 dakika
  },
  // Grup önbelleği
  group: {
    max: 100, // Maksimum 100 grup
    ttl: 30 * 60 * 1000, // 30 dakika
  },
  // Kanal önbelleği
  channel: {
    max: 200, // Maksimum 200 kanal
    ttl: 30 * 60 * 1000, // 30 dakika
  },
  // Mesaj önbelleği
  message: {
    max: 1000, // Maksimum 1000 mesaj
    ttl: 5 * 60 * 1000, // 5 dakika
  },
  // API yanıtları önbelleği
  api: {
    max: 200, // Maksimum 200 API yanıtı
    ttl: 60 * 1000, // 1 dakika
  },
  // Dosya önbelleği
  file: {
    max: 100, // Maksimum 100 dosya
    ttl: 60 * 60 * 1000, // 1 saat
  }
};

// Önbellek türleri
export type CacheType = keyof typeof CACHE_CONFIG;

/**
 * Mesaj önbelleği
 */
export const messageCache = new LRUCache(CACHE_CONFIG.message.max, CACHE_CONFIG.message.ttl);

/**
 * Kullanıcı önbelleği
 */
export const userCache = new LRUCache(CACHE_CONFIG.user.max, CACHE_CONFIG.user.ttl);

/**
 * Grup önbelleği
 */
export const groupCache = new LRUCache(CACHE_CONFIG.group.max, CACHE_CONFIG.group.ttl);

/**
 * Kanal önbelleği
 */
export const channelCache = new LRUCache(CACHE_CONFIG.channel.max, CACHE_CONFIG.channel.ttl);

/**
 * API yanıtları önbelleği
 */
export const apiCache = new LRUCache(CACHE_CONFIG.api.max, CACHE_CONFIG.api.ttl);

/**
 * Dosya önbelleği
 */
export const fileCache = new LRUCache(CACHE_CONFIG.file.max, CACHE_CONFIG.file.ttl);

/**
 * Tüm önbellekler
 */
export const caches: Record<CacheType, LRUCache<any>> = {
  user: userCache,
  group: groupCache,
  channel: channelCache,
  message: messageCache,
  api: apiCache,
  file: fileCache
};

/**
 * Önbelleğe veri ekler
 * @param type Önbellek türü
 * @param key Anahtar
 * @param value Değer
 * @param ttl Yaşam süresi (ms)
 */
export function setCache<T>(type: CacheType, key: string, value: T, ttl?: number): void {
  try {
    const cache = caches[type];
    if (!cache) {
      logger.warn(`Geçersiz önbellek türü: ${type}`);
      return;
    }

    cache.set(key, value, ttl);
  } catch (error) {
    logger.error('Önbelleğe veri eklenirken hata oluştu', {
      error: (error as Error).message,
      type,
      key
    });
  }
}

/**
 * Önbellekten veri getirir
 * @param type Önbellek türü
 * @param key Anahtar
 * @returns Önbellekteki değer veya undefined
 */
export function getCache<T>(type: CacheType, key: string): T | undefined {
  try {
    const cache = caches[type];
    if (!cache) {
      logger.warn(`Geçersiz önbellek türü: ${type}`);
      return undefined;
    }

    return cache.get(key) as T | undefined;
  } catch (error) {
    logger.error('Önbellekten veri getirilirken hata oluştu', {
      error: (error as Error).message,
      type,
      key
    });
    return undefined;
  }
}

/**
 * Önbellekten veri siler
 * @param type Önbellek türü
 * @param key Anahtar
 */
export function deleteCache(type: CacheType, key: string): void {
  try {
    const cache = caches[type];
    if (!cache) {
      logger.warn(`Geçersiz önbellek türü: ${type}`);
      return;
    }

    cache.delete(key);
  } catch (error) {
    logger.error('Önbellekten veri silinirken hata oluştu', {
      error: (error as Error).message,
      type,
      key
    });
  }
}

/**
 * Önbelleği temizler
 * @param type Önbellek türü (belirtilmezse tüm önbellekler temizlenir)
 */
export function clearCache(type?: CacheType): void {
  try {
    if (type) {
      const cache = caches[type];
      if (!cache) {
        logger.warn(`Geçersiz önbellek türü: ${type}`);
        return;
      }

      cache.clear();
      logger.info(`Önbellek temizlendi: ${type}`);
    } else {
      // Tüm önbellekleri temizle
      Object.keys(caches).forEach(type => {
        caches[type as CacheType].clear();
      });

      logger.info('Tüm önbellekler temizlendi');
    }
  } catch (error) {
    logger.error('Önbellek temizlenirken hata oluştu', {
      error: (error as Error).message,
      type
    });
  }
}

/**
 * Önbellek istatistiklerini loglar
 */
export function logCacheStats(): void {
  try {
    const stats: Record<string, any> = {};

    Object.entries(caches).forEach(([type, cache]) => {
      stats[type] = cache.getStats();
    });

    logger.debug('Önbellek istatistikleri', { stats });
  } catch (error) {
    logger.error('Önbellek istatistikleri loglanırken hata oluştu', {
      error: (error as Error).message
    });
  }
}

/**
 * Bellek kullanımını günlüğe kaydeder
 */
export function logMemoryUsage(): void {
  const memoryUsage = process.memoryUsage();

  logger.info('Bellek kullanımı', {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  });
}

// Periyodik olarak bellek kullanımını ve önbellek istatistiklerini günlüğe kaydet
setInterval(() => {
  logMemoryUsage();
  logCacheStats();
}, 3600000); // Her saat

export default {
  LRUCache,
  messageCache,
  userCache,
  groupCache,
  channelCache,
  apiCache,
  fileCache,
  caches,
  setCache,
  getCache,
  deleteCache,
  clearCache,
  logCacheStats,
  logMemoryUsage
};
