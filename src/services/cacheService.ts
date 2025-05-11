/**
 * src/services/cacheService.ts
 * Önbellek servisi
 */
import { LRUCache } from 'lru-cache';
import { createClient } from 'ioredis';
import logger from '../utils/logger';

// Önbellek türleri
type CacheType = 'memory' | 'redis' | 'none';

// Önbellek seçenekleri
interface CacheOptions {
  type: CacheType;
  ttl?: number; // Saniye cinsinden yaşam süresi
  maxSize?: number; // Maksimum önbellek boyutu
  redisUrl?: string; // Redis URL
}

/**
 * Önbellek servisi
 * Bellek içi LRU önbellek ve Redis önbellek desteği sağlar
 */
class CacheService {
  private type: CacheType;
  private memoryCache: LRUCache<string, any> | null = null;
  private redisClient: ReturnType<typeof createClient> | null = null;
  private defaultTTL: number;
  private enabled: boolean = true;

  /**
   * Önbellek servisini başlatır
   * @param options Önbellek seçenekleri
   */
  constructor(options: CacheOptions) {
    this.type = options.type;
    this.defaultTTL = options.ttl || 300; // Varsayılan 5 dakika

    // Önbellek türüne göre başlat
    if (this.type === 'memory') {
      this.initMemoryCache(options);
    } else if (this.type === 'redis') {
      this.initRedisCache(options);
    } else {
      this.enabled = false;
      logger.info('Önbellek devre dışı bırakıldı');
    }
  }

  /**
   * Bellek içi önbelleği başlatır
   * @param options Önbellek seçenekleri
   */
  private initMemoryCache(options: CacheOptions): void {
    const maxSize = options.maxSize || 1000;

    this.memoryCache = new LRUCache({
      max: maxSize,
      ttl: this.defaultTTL * 1000, // Milisaniye cinsinden
      updateAgeOnGet: true, // Erişimde yaşam süresini güncelle
      allowStale: false, // Süresi dolmuş öğeleri döndürme
    });

    logger.info('Bellek içi önbellek başlatıldı', { maxSize, ttl: this.defaultTTL });
  }

  /**
   * Redis önbelleği başlatır
   * @param options Önbellek seçenekleri
   */
  private initRedisCache(options: CacheOptions): void {
    const redisUrl = options.redisUrl || 'redis://localhost:6379';

    try {
      this.redisClient = createClient({
        url: redisUrl,
        maxRetriesPerRequest: 3,
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis bağlantı hatası', { error: err.message });
        // Hata durumunda bellek içi önbelleğe geç
        if (!this.memoryCache) {
          this.initMemoryCache(options);
        }
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis bağlantısı kuruldu', { url: redisUrl });
      });

      logger.info('Redis önbellek başlatıldı', { url: redisUrl });
    } catch (error) {
      logger.error('Redis önbellek başlatılamadı', { error: (error as Error).message });
      // Hata durumunda bellek içi önbelleğe geç
      this.initMemoryCache(options);
    }
  }

  /**
   * Önbellekten değer alır
   * @param key Anahtar
   * @returns Değer veya null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      if (this.type === 'memory' && this.memoryCache) {
        return (this.memoryCache.get(key) as T) || null;
      } else if (this.type === 'redis' && this.redisClient) {
        const value = await this.redisClient.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
      }
    } catch (error) {
      logger.error('Önbellek okuma hatası', { key, error: (error as Error).message });
    }

    return null;
  }

  /**
   * Önbelleğe değer kaydeder
   * @param key Anahtar
   * @param value Değer
   * @param ttl Yaşam süresi (saniye)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled) return;

    const expiry = ttl || this.defaultTTL;

    try {
      if (this.type === 'memory' && this.memoryCache) {
        this.memoryCache.set(key, value, { ttl: expiry * 1000 });
      } else if (this.type === 'redis' && this.redisClient) {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', expiry);
      }
    } catch (error) {
      logger.error('Önbellek yazma hatası', { key, error: (error as Error).message });
    }
  }

  /**
   * Önbellekten değer siler
   * @param key Anahtar
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      if (this.type === 'memory' && this.memoryCache) {
        this.memoryCache.delete(key);
      } else if (this.type === 'redis' && this.redisClient) {
        await this.redisClient.del(key);
      }
    } catch (error) {
      logger.error('Önbellek silme hatası', { key, error: (error as Error).message });
    }
  }

  /**
   * Belirli bir desene uyan tüm anahtarları siler
   * @param pattern Anahtar deseni (örn. "user:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.enabled) return;

    try {
      if (this.type === 'memory' && this.memoryCache) {
        // LRU Cache'de desen silme desteği yok, tüm önbelleği temizle
        this.memoryCache.clear();
      } else if (this.type === 'redis' && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }
    } catch (error) {
      logger.error('Önbellek desen silme hatası', { pattern, error: (error as Error).message });
    }
  }

  /**
   * Tüm önbelleği temizler
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;

    try {
      if (this.type === 'memory' && this.memoryCache) {
        this.memoryCache.clear();
      } else if (this.type === 'redis' && this.redisClient) {
        await this.redisClient.flushdb();
      }
    } catch (error) {
      logger.error('Önbellek temizleme hatası', { error: (error as Error).message });
    }
  }

  /**
   * Önbellek istatistiklerini alır
   * @returns Önbellek istatistikleri
   */
  async getStats(): Promise<any> {
    if (!this.enabled) return { enabled: false };

    try {
      if (this.type === 'memory' && this.memoryCache) {
        return {
          type: 'memory',
          size: this.memoryCache.size,
          maxSize: this.memoryCache.max,
          hitRate: this.calculateHitRate(this.memoryCache),
        };
      } else if (this.type === 'redis' && this.redisClient) {
        const info = await this.redisClient.info();
        return {
          type: 'redis',
          info: this.parseRedisInfo(info),
        };
      }
    } catch (error) {
      logger.error('Önbellek istatistikleri alınamadı', { error: (error as Error).message });
    }

    return { enabled: this.enabled, type: this.type };
  }

  /**
   * LRU Cache isabet oranını hesaplar
   * @param cache LRU Cache
   * @returns İsabet oranı
   */
  private calculateHitRate(cache: LRUCache<string, any>): number {
    const stats = {
      hits: cache.hits,
      misses: cache.misses,
      total: cache.hits + cache.misses,
    };

    return stats.total > 0 ? stats.hits / stats.total : 0;
  }

  /**
   * Redis bilgilerini ayrıştırır
   * @param info Redis bilgileri
   * @returns Ayrıştırılmış bilgiler
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const parts = line.split(':');
        if (parts.length === 2) {
          result[parts[0]] = parts[1].trim();
        }
      }
    }

    return result;
  }
}

// Singleton örneği
let cacheServiceInstance: CacheService | null = null;

/**
 * Önbellek servisini başlatır
 * @param options Önbellek seçenekleri
 * @returns Önbellek servisi
 */
export function initCacheService(options: CacheOptions): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(options);
  }
  return cacheServiceInstance;
}

/**
 * Önbellek servisini alır
 * @returns Önbellek servisi
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    // Varsayılan olarak bellek içi önbellek kullan
    cacheServiceInstance = new CacheService({
      type: (process.env.CACHE_TYPE as CacheType) || 'memory',
      ttl: parseInt(process.env.CACHE_TTL || '300'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
      redisUrl: process.env.REDIS_URL,
    });
  }
  return cacheServiceInstance;
}

export default getCacheService();
