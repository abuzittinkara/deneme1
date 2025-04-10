/**
 * Redis yapılandırması
 * Bu dosya Redis bağlantı ayarlarını ve yardımcı fonksiyonları içerir
 */
const Redis = require('ioredis');
const { logger } = require('../utils/logger');

// Redis bağlantı seçenekleri
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'sesli-sohbet:',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Redis istemcisi oluştur
let redisClient;

// Redis bağlantısını devre dışı bırakmak için sahte bir istemci oluştur
const createMockRedisClient = () => {
  const mockClient = {
    // Temel metodlar
    ping: async () => 'PONG',
    set: async () => 'OK',
    get: async () => null,
    del: async () => 0,
    expire: async () => 1,
    incrby: async () => 0,
    hset: async () => 0,
    hget: async () => null,
    hgetall: async () => ({}),
    lpush: async () => 0,
    lrange: async () => [],
    sadd: async () => 0,
    smembers: async () => [],
    srem: async () => 0,
    exists: async () => 0,
    ttl: async () => -1,
    publish: async () => 0,
    info: async () => 'redis_version:mock',
    duplicate: () => mockClient,

    // Event emitter metodları
    on: (event, callback) => {
      if (event === 'ready') {
        setTimeout(callback, 0);
      }
      return mockClient;
    },
    once: (event, callback) => {
      if (event === 'ready') {
        setTimeout(callback, 0);
      }
      return mockClient;
    },
    emit: () => true,
    subscribe: (channel, callback) => callback(null, 1),
  };

  return mockClient;
};

// Redis bağlantısını oluşturmayı dene, başarısız olursa sahte istemci kullan
const useRedisMock = process.env.USE_REDIS_MOCK === 'true' || false;

if (useRedisMock) {
  logger.info('Redis sahte modu etkin, sahte istemci kullanılıyor');
  redisClient = createMockRedisClient();
} else {
  try {
    // Redis bağlantı denemesi sırasında hata olursa, sahte istemciye geç
    redisClient = new Redis({
      ...redisOptions,
      // Bağlantı denemelerini sınırla
      connectTimeout: 2000, // 2 saniye
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        // İlk deneme başarısız olursa, sahte istemciye geç
        if (times > 1) {
          logger.warn('Redis bağlantısı kurulamadı, sahte istemci kullanılıyor');
          // Global değişkeni güncelle
          process.env.USE_REDIS_MOCK = 'true';
          // Sahte istemci oluştur
          redisClient = createMockRedisClient();
          // Yeniden deneme yapma
          return null;
        }
        return 1000; // 1 saniye sonra tekrar dene
      }
    });
  } catch (error) {
    logger.warn('Redis bağlantısı kurulamadı, sahte istemci kullanılıyor', { error: error.message });
    redisClient = createMockRedisClient();
  }
}

// Bağlantı olaylarını dinle
redisClient.on('connect', () => {
  logger.info('Redis bağlantısı kuruldu');
});

redisClient.on('ready', () => {
  logger.info('Redis kullanıma hazır');
});

redisClient.on('error', (err) => {
  logger.error('Redis bağlantı hatası', { error: err.message });
});

redisClient.on('close', () => {
  logger.warn('Redis bağlantısı kapatıldı');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis yeniden bağlanıyor');
});

/**
 * Redis'e veri kaydetme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {any} value - Değer
 * @param {number} [ttl=null] - Yaşam süresi (saniye)
 * @returns {Promise<string>} - İşlem sonucu
 */
async function setCache(key, value, ttl = null) {
  try {
    const serializedValue = JSON.stringify(value);

    if (ttl) {
      return await redisClient.set(key, serializedValue, 'EX', ttl);
    } else {
      return await redisClient.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Redis set hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'ten veri getirme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @returns {Promise<any>} - Değer
 */
async function getCache(key) {
  try {
    const value = await redisClient.get(key);

    if (!value) return null;

    return JSON.parse(value);
  } catch (error) {
    logger.error('Redis get hatası', { error: error.message, key });
    return null;
  }
}

/**
 * Redis'ten veri silme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @returns {Promise<number>} - Silinen anahtar sayısı
 */
async function deleteCache(key) {
  try {
    return await redisClient.del(key);
  } catch (error) {
    logger.error('Redis delete hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'te bir anahtarın süresini güncelleme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {number} ttl - Yaşam süresi (saniye)
 * @returns {Promise<number>} - İşlem sonucu (1: başarılı, 0: anahtar bulunamadı)
 */
async function expireCache(key, ttl) {
  try {
    return await redisClient.expire(key, ttl);
  } catch (error) {
    logger.error('Redis expire hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'te bir sayaç artırma yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {number} [increment=1] - Artış miktarı
 * @param {number} [ttl=null] - Yaşam süresi (saniye)
 * @returns {Promise<number>} - Güncellenmiş değer
 */
async function incrementCache(key, increment = 1, ttl = null) {
  try {
    const value = await redisClient.incrby(key, increment);

    if (ttl) {
      await redisClient.expire(key, ttl);
    }

    return value;
  } catch (error) {
    logger.error('Redis increment hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'te bir hash değeri kaydetme yardımcı fonksiyonu
 * @param {string} key - Ana anahtar
 * @param {string} field - Alan
 * @param {any} value - Değer
 * @param {number} [ttl=null] - Yaşam süresi (saniye)
 * @returns {Promise<number>} - İşlem sonucu
 */
async function setHashCache(key, field, value, ttl = null) {
  try {
    const serializedValue = JSON.stringify(value);
    const result = await redisClient.hset(key, field, serializedValue);

    if (ttl) {
      await redisClient.expire(key, ttl);
    }

    return result;
  } catch (error) {
    logger.error('Redis hash set hatası', { error: error.message, key, field });
    throw error;
  }
}

/**
 * Redis'ten bir hash değeri getirme yardımcı fonksiyonu
 * @param {string} key - Ana anahtar
 * @param {string} field - Alan
 * @returns {Promise<any>} - Değer
 */
async function getHashCache(key, field) {
  try {
    const value = await redisClient.hget(key, field);

    if (!value) return null;

    return JSON.parse(value);
  } catch (error) {
    logger.error('Redis hash get hatası', { error: error.message, key, field });
    return null;
  }
}

/**
 * Redis'ten tüm hash değerlerini getirme yardımcı fonksiyonu
 * @param {string} key - Ana anahtar
 * @returns {Promise<Object>} - Tüm alanlar ve değerler
 */
async function getAllHashCache(key) {
  try {
    const values = await redisClient.hgetall(key);

    if (!values) return {};

    // Tüm değerleri parse et
    Object.keys(values).forEach(field => {
      try {
        values[field] = JSON.parse(values[field]);
      } catch (e) {
        // Parse edilemezse olduğu gibi bırak
      }
    });

    return values;
  } catch (error) {
    logger.error('Redis hash getall hatası', { error: error.message, key });
    return {};
  }
}

/**
 * Redis'te bir liste değeri ekleme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {any} value - Değer
 * @param {number} [ttl=null] - Yaşam süresi (saniye)
 * @returns {Promise<number>} - Listenin yeni uzunluğu
 */
async function addToListCache(key, value, ttl = null) {
  try {
    const serializedValue = JSON.stringify(value);
    const length = await redisClient.rpush(key, serializedValue);

    if (ttl) {
      await redisClient.expire(key, ttl);
    }

    return length;
  } catch (error) {
    logger.error('Redis list add hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'ten bir liste değerlerini getirme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {number} [start=0] - Başlangıç indeksi
 * @param {number} [end=-1] - Bitiş indeksi
 * @returns {Promise<Array>} - Liste değerleri
 */
async function getListCache(key, start = 0, end = -1) {
  try {
    const values = await redisClient.lrange(key, start, end);

    return values.map(value => {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    });
  } catch (error) {
    logger.error('Redis list get hatası', { error: error.message, key });
    return [];
  }
}

/**
 * Redis'te bir set değeri ekleme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {any} value - Değer
 * @param {number} [ttl=null] - Yaşam süresi (saniye)
 * @returns {Promise<number>} - Eklenen eleman sayısı
 */
async function addToSetCache(key, value, ttl = null) {
  try {
    const serializedValue = JSON.stringify(value);
    const result = await redisClient.sadd(key, serializedValue);

    if (ttl) {
      await redisClient.expire(key, ttl);
    }

    return result;
  } catch (error) {
    logger.error('Redis set add hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'ten bir set değerlerini getirme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @returns {Promise<Array>} - Set değerleri
 */
async function getSetCache(key) {
  try {
    const values = await redisClient.smembers(key);

    return values.map(value => {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    });
  } catch (error) {
    logger.error('Redis set get hatası', { error: error.message, key });
    return [];
  }
}

/**
 * Redis'te bir set değeri silme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @param {any} value - Değer
 * @returns {Promise<number>} - Silinen eleman sayısı
 */
async function removeFromSetCache(key, value) {
  try {
    const serializedValue = JSON.stringify(value);
    return await redisClient.srem(key, serializedValue);
  } catch (error) {
    logger.error('Redis set remove hatası', { error: error.message, key });
    throw error;
  }
}

/**
 * Redis'te bir anahtarın var olup olmadığını kontrol etme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @returns {Promise<boolean>} - Anahtar var mı
 */
async function existsCache(key) {
  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Redis exists hatası', { error: error.message, key });
    return false;
  }
}

/**
 * Redis'te bir anahtarın kalan yaşam süresini getirme yardımcı fonksiyonu
 * @param {string} key - Anahtar
 * @returns {Promise<number>} - Kalan yaşam süresi (saniye)
 */
async function getTTL(key) {
  try {
    return await redisClient.ttl(key);
  } catch (error) {
    logger.error('Redis TTL hatası', { error: error.message, key });
    return -2; // Anahtar bulunamadı
  }
}

/**
 * Redis'te bir pub/sub kanalına abone olma yardımcı fonksiyonu
 * @param {string} channel - Kanal
 * @param {Function} callback - Geri çağrı fonksiyonu
 * @returns {void}
 */
function subscribe(channel, callback) {
  try {
    const subscriber = redisClient.duplicate();

    subscriber.subscribe(channel, (err, count) => {
      if (err) {
        logger.error('Redis subscribe hatası', { error: err.message, channel });
        return;
      }

      logger.info(`Redis ${channel} kanalına abone olundu`);
    });

    subscriber.on('message', (channel, message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        logger.error('Redis message parse hatası', { error: error.message, channel });
        callback(message);
      }
    });

    return subscriber;
  } catch (error) {
    logger.error('Redis subscribe hatası', { error: error.message, channel });
    throw error;
  }
}

/**
 * Redis'te bir pub/sub kanalına mesaj yayınlama yardımcı fonksiyonu
 * @param {string} channel - Kanal
 * @param {any} message - Mesaj
 * @returns {Promise<number>} - Mesajı alan abone sayısı
 */
async function publish(channel, message) {
  try {
    const serializedMessage = JSON.stringify(message);
    return await redisClient.publish(channel, serializedMessage);
  } catch (error) {
    logger.error('Redis publish hatası', { error: error.message, channel });
    throw error;
  }
}

module.exports = {
  redisClient,
  setCache,
  getCache,
  deleteCache,
  expireCache,
  incrementCache,
  setHashCache,
  getHashCache,
  getAllHashCache,
  addToListCache,
  getListCache,
  addToSetCache,
  getSetCache,
  removeFromSetCache,
  existsCache,
  getTTL,
  subscribe,
  publish
};
