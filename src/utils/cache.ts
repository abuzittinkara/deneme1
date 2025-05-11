/**
 * src/utils/cache.ts
 * Çok seviyeli önbellek stratejisi
 */
import { LRUCache } from 'lru-cache';
import { logger } from './logger';
import { getCache, setCache, deleteCache, existsCache, getTTL } from '../config/redis';

// Önbellek seçenekleri için arayüz
export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
}

/**
 * Çok seviyeli önbellek sınıfı
 * L1: Bellek içi önbellek (en hızlı, en küçük)
 * L2: Redis önbelleği (orta hız, orta boyut)
 */
export class MultiLevelCache {
  private memoryCache: LRUCache<string, any>;
  private defaultTTL: number;

  /**
   * @param options - Önbellek seçenekleri
   */
  constructor(options: CacheOptions = {}) {
    const {
      maxSize = 1000,
      ttl = 60 * 60, // 1 saat
    } = options;

    // L1: Bellek içi önbellek
    this.memoryCache = new LRUCache({
      max: maxSize,
      ttl: ttl * 1000, // milisaniye cinsinden
      updateAgeOnGet: true,
      allowStale: false,
    });

    // Varsayılan TTL
    this.defaultTTL = ttl;

    logger.info('Çok seviyeli önbellek başlatıldı', { maxSize, ttl });
  }

  /**
   * Önbellekten veri getirir
   * @param key - Anahtar
   * @returns Değer
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // L1: Bellek içi önbellekten kontrol et
      const memoryResult = this.memoryCache.get(key) as T | undefined;

      if (memoryResult !== undefined) {
        logger.debug('Önbellek L1 hit', { key });
        return memoryResult;
      }

      // L2: Redis önbelleğinden kontrol et
      const redisResult = await getCache<T>(key);

      if (redisResult !== null) {
        // L1'e ekle
        this.memoryCache.set(key, redisResult);
        logger.debug('Önbellek L2 hit', { key });
        return redisResult;
      }

      logger.debug('Önbellek miss', { key });
      return null;
    } catch (error) {
      logger.error('Önbellek get hatası', { error: (error as Error).message, key });
      return null;
    }
  }

  /**
   * Önbelleğe veri kaydeder
   * @param key - Anahtar
   * @param value - Değer
   * @param ttl - TTL (saniye)
   * @returns İşlem başarılı mı
   */
  async set<T = any>(key: string, value: T, ttl: number | null = null): Promise<boolean> {
    try {
      // TTL belirtilmemişse varsayılanı kullan
      const actualTTL = ttl || this.defaultTTL;

      // L1: Bellek içi önbelleğe ekle
      this.memoryCache.set(key, value, { ttl: actualTTL * 1000 });

      // L2: Redis önbelleğine ekle
      await setCache(key, value, actualTTL);

      logger.debug('Önbelleğe kaydedildi', { key, ttl: actualTTL });
      return true;
    } catch (error) {
      logger.error('Önbellek set hatası', { error: (error as Error).message, key });
      return false;
    }
  }

  /**
   * Önbellekten veri siler
   * @param key - Anahtar
   * @returns İşlem başarılı mı
   */
  async delete(key: string): Promise<boolean> {
    try {
      // L1: Bellek içi önbellekten sil
      this.memoryCache.delete(key);

      // L2: Redis önbelleğinden sil
      await deleteCache(key);

      logger.debug('Önbellekten silindi', { key });
      return true;
    } catch (error) {
      logger.error('Önbellek delete hatası', { error: (error as Error).message, key });
      return false;
    }
  }

  /**
   * Önbellekte anahtarın var olup olmadığını kontrol eder
   * @param key - Anahtar
   * @returns Anahtar var mı
   */
  async has(key: string): Promise<boolean> {
    try {
      // L1: Bellek içi önbellekte kontrol et
      if (this.memoryCache.has(key)) {
        return true;
      }

      // L2: Redis önbelleğinde kontrol et
      return await existsCache(key);
    } catch (error) {
      logger.error('Önbellek has hatası', { error: (error as Error).message, key });
      return false;
    }
  }

  /**
   * Önbellekteki anahtarın TTL'sini getirir
   * @param key - Anahtar
   * @returns TTL (saniye)
   */
  async ttl(key: string): Promise<number> {
    try {
      // L1: Bellek içi önbellekte kontrol et
      const memoryTTL = this.memoryCache.getRemainingTTL(key);

      if (memoryTTL > 0) {
        return Math.floor(memoryTTL / 1000);
      }

      // L2: Redis önbelleğinde kontrol et
      return await getTTL(key);
    } catch (error) {
      logger.error('Önbellek ttl hatası', { error: (error as Error).message, key });
      return -2; // Anahtar bulunamadı
    }
  }

  /**
   * Önbelleği temizler
   * @returns İşlem başarılı mı
   */
  async clear(): Promise<boolean> {
    try {
      // L1: Bellek içi önbelleği temizle
      this.memoryCache.clear();

      logger.info('Önbellek temizlendi');
      return true;
    } catch (error) {
      logger.error('Önbellek clear hatası', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Önbellek istatistiklerini getirir
   * @returns İstatistikler
   */
  getStats(): Record<string, number> {
    return {
      memorySize: this.memoryCache.size,
      memoryMaxSize: this.memoryCache.max as number,
      memoryItemCount: this.memoryCache.size,
    };
  }
}

// Varsayılan önbellek örneği
export const defaultCache = new MultiLevelCache();

// Uygulama önbellekleri
export const caches = {
  users: new MultiLevelCache({ maxSize: 500, ttl: 3600 }),
  messages: new MultiLevelCache({ maxSize: 1000, ttl: 1800 }),
  groups: new MultiLevelCache({ maxSize: 300, ttl: 3600 }),
  channels: new MultiLevelCache({ maxSize: 500, ttl: 3600 }),
  notifications: new MultiLevelCache({ maxSize: 500, ttl: 1800 }),
};

export default {
  MultiLevelCache,
  defaultCache,
  caches,
};
