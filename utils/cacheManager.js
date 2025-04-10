/**************************************
 * utils/cacheManager.js
 * Önbellek yönetimi
 **************************************/
const { logger } = require('./logger');

/**
 * LRU (Least Recently Used) Önbellek sınıfı
 */
class LRUCache {
  /**
   * LRU Önbellek oluşturur
   * @param {number} capacity - Maksimum önbellek kapasitesi
   * @param {number} ttl - Önbellek öğelerinin yaşam süresi (milisaniye)
   */
  constructor(capacity = 1000, ttl = 3600000) {
    this.capacity = capacity;
    this.ttl = ttl;
    this.cache = new Map();
    this.keys = [];
    
    // Periyodik temizleme
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 dakikada bir
    
    logger.info('LRU Önbellek oluşturuldu', { capacity, ttl });
  }
  
  /**
   * Önbellekten değer getirir
   * @param {string} key - Önbellek anahtarı
   * @returns {*} - Önbellekteki değer veya undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    const item = this.cache.get(key);
    
    // TTL kontrolü
    if (Date.now() > item.expiry) {
      this.delete(key);
      return undefined;
    }
    
    // Anahtarı en sona taşı (en son kullanılan)
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);
    
    return item.value;
  }
  
  /**
   * Önbelleğe değer ekler
   * @param {string} key - Önbellek anahtarı
   * @param {*} value - Saklanacak değer
   * @param {number} [customTtl] - Özel TTL değeri (milisaniye)
   */
  set(key, value, customTtl) {
    // Kapasite kontrolü
    if (this.keys.length >= this.capacity && !this.cache.has(key)) {
      // En eski anahtarı sil (en az kullanılan)
      const oldestKey = this.keys.shift();
      this.cache.delete(oldestKey);
      
      logger.debug('Önbellekten eski öğe silindi', { key: oldestKey });
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
   * @param {string} key - Önbellek anahtarı
   */
  delete(key) {
    this.cache.delete(key);
    this.keys = this.keys.filter(k => k !== key);
    
    logger.debug('Önbellekten öğe silindi', { key });
  }
  
  /**
   * Önbelleği temizler
   */
  clear() {
    this.cache.clear();
    this.keys = [];
    
    logger.info('Önbellek temizlendi');
  }
  
  /**
   * Süresi dolmuş öğeleri temizler
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
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
   * @returns {Object} - Önbellek istatistikleri
   */
  getStats() {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      ttl: this.ttl,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
  
  /**
   * Önbelleği kapatır
   */
  close() {
    clearInterval(this.cleanupInterval);
    this.clear();
    
    logger.info('Önbellek kapatıldı');
  }
}

/**
 * Mesaj önbelleği
 */
const messageCache = new LRUCache(1000, 3600000); // 1000 mesaj, 1 saat TTL

/**
 * Kullanıcı önbelleği
 */
const userCache = new LRUCache(500, 1800000); // 500 kullanıcı, 30 dakika TTL

/**
 * Grup önbelleği
 */
const groupCache = new LRUCache(100, 3600000); // 100 grup, 1 saat TTL

/**
 * Kanal önbelleği
 */
const channelCache = new LRUCache(200, 3600000); // 200 kanal, 1 saat TTL

/**
 * Bellek kullanımını günlüğe kaydeder
 */
function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  
  logger.info('Bellek kullanımı', {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  });
}

// Periyodik olarak bellek kullanımını günlüğe kaydet
setInterval(logMemoryUsage, 3600000); // Her saat

module.exports = {
  LRUCache,
  messageCache,
  userCache,
  groupCache,
  channelCache,
  logMemoryUsage
};
