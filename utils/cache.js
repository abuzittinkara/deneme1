/**
 * utils/cache.js
 * Çok seviyeli önbellek stratejisi
 */
const LRU = require('lru-cache');
const { logger } = require('./logger');
const { getCache, setCache, deleteCache, existsCache, getTTL } = require('../config/redis');

/**
 * Çok seviyeli önbellek sınıfı
 * L1: Bellek içi önbellek (en hızlı, en küçük)
 * L2: Redis önbelleği (orta hız, orta boyut)
 */
class MultiLevelCache {
  /**
   * @param {Object} options - Önbellek seçenekleri
   * @param {number} options.maxSize - Bellek içi önbellek maksimum boyutu
   * @param {number} options.ttl - Varsayılan TTL (saniye)
   */
  constructor(options = {}) {
    const {
      maxSize = 1000,
      ttl = 60 * 60 // 1 saat
    } = options;
    
    // L1: Bellek içi önbellek
    this.memoryCache = new LRU({
      max: maxSize,
      ttl: ttl * 1000, // milisaniye cinsinden
      updateAgeOnGet: true,
      allowStale: false
    });
    
    // Varsayılan TTL
    this.defaultTTL = ttl;
    
    logger.info('Çok seviyeli önbellek başlatıldı', { maxSize, ttl });
  }
  
  /**
   * Önbellekten veri getirir
   * @param {string} key - Anahtar
   * @returns {Promise<any>} - Değer
   */
  async get(key) {
    try {
      // L1: Bellek içi önbellekten kontrol et
      const memoryResult = this.memoryCache.get(key);
      
      if (memoryResult !== undefined) {
        logger.debug('Önbellek L1 hit', { key });
        return memoryResult;
      }
      
      // L2: Redis önbelleğinden kontrol et
      const redisResult = await getCache(key);
      
      if (redisResult !== null) {
        // L1'e ekle
        this.memoryCache.set(key, redisResult);
        logger.debug('Önbellek L2 hit', { key });
        return redisResult;
      }
      
      logger.debug('Önbellek miss', { key });
      return null;
    } catch (error) {
      logger.error('Önbellek get hatası', { error: error.message, key });
      return null;
    }
  }
  
  /**
   * Önbelleğe veri kaydeder
   * @param {string} key - Anahtar
   * @param {any} value - Değer
   * @param {number} [ttl=null] - TTL (saniye)
   * @returns {Promise<boolean>} - İşlem başarılı mı
   */
  async set(key, value, ttl = null) {
    try {
      // TTL belirtilmemişse varsayılanı kullan
      const actualTTL = ttl || this.defaultTTL;
      
      // L1: Bellek içi önbelleğe ekle
      this.memoryCache.set(key, value, actualTTL * 1000);
      
      // L2: Redis önbelleğine ekle
      await setCache(key, value, actualTTL);
      
      logger.debug('Önbelleğe kaydedildi', { key, ttl: actualTTL });
      return true;
    } catch (error) {
      logger.error('Önbellek set hatası', { error: error.message, key });
      return false;
    }
  }
  
  /**
   * Önbellekten veri siler
   * @param {string} key - Anahtar
   * @returns {Promise<boolean>} - İşlem başarılı mı
   */
  async delete(key) {
    try {
      // L1: Bellek içi önbellekten sil
      this.memoryCache.delete(key);
      
      // L2: Redis önbelleğinden sil
      await deleteCache(key);
      
      logger.debug('Önbellekten silindi', { key });
      return true;
    } catch (error) {
      logger.error('Önbellek delete hatası', { error: error.message, key });
      return false;
    }
  }
  
  /**
   * Önbellekte anahtarın var olup olmadığını kontrol eder
   * @param {string} key - Anahtar
   * @returns {Promise<boolean>} - Anahtar var mı
   */
  async has(key) {
    try {
      // L1: Bellek içi önbellekte kontrol et
      if (this.memoryCache.has(key)) {
        return true;
      }
      
      // L2: Redis önbelleğinde kontrol et
      return await existsCache(key);
    } catch (error) {
      logger.error('Önbellek has hatası', { error: error.message, key });
      return false;
    }
  }
  
  /**
   * Önbellekteki anahtarın TTL'sini getirir
   * @param {string} key - Anahtar
   * @returns {Promise<number>} - TTL (saniye)
   */
  async ttl(key) {
    try {
      // L1: Bellek içi önbellekte kontrol et
      const memoryTTL = this.memoryCache.getRemainingTTL(key);
      
      if (memoryTTL > 0) {
        return Math.floor(memoryTTL / 1000);
      }
      
      // L2: Redis önbelleğinde kontrol et
      return await getTTL(key);
    } catch (error) {
      logger.error('Önbellek ttl hatası', { error: error.message, key });
      return -2; // Anahtar bulunamadı
    }
  }
  
  /**
   * Önbelleği temizler
   * @returns {Promise<boolean>} - İşlem başarılı mı
   */
  async clear() {
    try {
      // L1: Bellek içi önbelleği temizle
      this.memoryCache.clear();
      
      logger.info('Önbellek temizlendi');
      return true;
    } catch (error) {
      logger.error('Önbellek clear hatası', { error: error.message });
      return false;
    }
  }
  
  /**
   * Önbellek istatistiklerini getirir
   * @returns {Object} - İstatistikler
   */
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      memoryMaxSize: this.memoryCache.max,
      memoryItemCount: this.memoryCache.size
    };
  }
}

// Varsayılan önbellek örneği
const defaultCache = new MultiLevelCache();

module.exports = {
  MultiLevelCache,
  defaultCache
};
