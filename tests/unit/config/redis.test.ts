/**
 * tests/unit/config/redis.test.ts
 * Redis bağlantısı için birim testleri
 */
import {
  setCache,
  getCache,
  deleteCache,
  incrementCache,
  existsCache,
  getTTL,
  setHashCache,
  getHashCache,
  getCachedData,
  RedisConnectionState
} from '../../../src/config/redis';
import { logger } from '../../../src/utils/logger';

// Redis ve logger modüllerini mock'la
jest.mock('ioredis', () => {
  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    incrby: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    expire: jest.fn().mockResolvedValue(1),
    hset: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    status: 'ready',
  };

  return jest.fn(() => mockRedis);
});

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Redis modülünü yeniden import et (mock'lar uygulandıktan sonra)
jest.mock('../../../src/config/redis', () => {
  const originalModule = jest.requireActual('../../../src/config/redis');
  
  // Mock redisClient ve redisConnectionManager
  const mockRedisClient = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    incrby: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    expire: jest.fn().mockResolvedValue(1),
    hset: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  
  const mockRedisConnectionManager = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    getState: jest.fn().mockReturnValue(originalModule.RedisConnectionState.READY),
    isHealthy: jest.fn().mockReturnValue(true),
    onStateChange: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  
  return {
    ...originalModule,
    redisClient: mockRedisClient,
    redisConnectionManager: mockRedisConnectionManager,
  };
});

describe('Redis Utils', () => {
  // Her test öncesinde mock'ları sıfırla
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('setCache', () => {
    it('should set a value in Redis', async () => {
      const key = 'test-key';
      const value = { name: 'test' };
      
      await setCache(key, value);
      
      // redisClient.set'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.set)
        .toHaveBeenCalledWith(key, JSON.stringify(value));
    });
    
    it('should set a value with TTL', async () => {
      const key = 'test-key';
      const value = { name: 'test' };
      const ttl = 3600;
      
      await setCache(key, value, ttl);
      
      // redisClient.set'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.set)
        .toHaveBeenCalledWith(key, JSON.stringify(value), 'EX', ttl);
    });
    
    it('should handle errors', async () => {
      const key = 'test-key';
      const value = { name: 'test' };
      const error = new Error('Redis error');
      
      // set fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.set.mockRejectedValueOnce(error);
      
      // Hata fırlatmasını bekle
      await expect(setCache(key, value)).rejects.toThrow('Redis error');
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis set hatası', { error: 'Redis error', key });
    });
  });
  
  describe('getCache', () => {
    it('should get a value from Redis', async () => {
      const key = 'test-key';
      const value = { name: 'test' };
      
      // get fonksiyonunu değer döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.get.mockResolvedValueOnce(JSON.stringify(value));
      
      const result = await getCache(key);
      
      // redisClient.get'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.get).toHaveBeenCalledWith(key);
      
      // Sonucu doğrula
      expect(result).toEqual(value);
    });
    
    it('should return null if key does not exist', async () => {
      const key = 'non-existent-key';
      
      // get fonksiyonunu null döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.get.mockResolvedValueOnce(null);
      
      const result = await getCache(key);
      
      // redisClient.get'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.get).toHaveBeenCalledWith(key);
      
      // Sonucu doğrula
      expect(result).toBeNull();
    });
    
    it('should handle errors', async () => {
      const key = 'test-key';
      const error = new Error('Redis error');
      
      // get fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.get.mockRejectedValueOnce(error);
      
      const result = await getCache(key);
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis get hatası', { error: 'Redis error', key });
      
      // Hata durumunda null döndürülmeli
      expect(result).toBeNull();
    });
  });
  
  describe('deleteCache', () => {
    it('should delete a key from Redis', async () => {
      const key = 'test-key';
      
      await deleteCache(key);
      
      // redisClient.del'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.del).toHaveBeenCalledWith(key);
    });
    
    it('should handle errors', async () => {
      const key = 'test-key';
      const error = new Error('Redis error');
      
      // del fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.del.mockRejectedValueOnce(error);
      
      // Hata fırlatmasını bekle
      await expect(deleteCache(key)).rejects.toThrow('Redis error');
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis delete hatası', { error: 'Redis error', key });
    });
  });
  
  describe('incrementCache', () => {
    it('should increment a counter in Redis', async () => {
      const key = 'counter-key';
      const increment = 5;
      
      // incrby fonksiyonunu değer döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.incrby.mockResolvedValueOnce(5);
      
      const result = await incrementCache(key, increment);
      
      // redisClient.incrby'ın doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.incrby).toHaveBeenCalledWith(key, increment);
      
      // Sonucu doğrula
      expect(result).toBe(5);
    });
    
    it('should increment with default value of 1', async () => {
      const key = 'counter-key';
      
      // incrby fonksiyonunu değer döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.incrby.mockResolvedValueOnce(1);
      
      await incrementCache(key);
      
      // redisClient.incrby'ın doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.incrby).toHaveBeenCalledWith(key, 1);
    });
    
    it('should set TTL if provided', async () => {
      const key = 'counter-key';
      const increment = 1;
      const ttl = 3600;
      
      await incrementCache(key, increment, ttl);
      
      // redisClient.expire'ın doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.expire).toHaveBeenCalledWith(key, ttl);
    });
    
    it('should handle errors', async () => {
      const key = 'counter-key';
      const error = new Error('Redis error');
      
      // incrby fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.incrby.mockRejectedValueOnce(error);
      
      // Hata fırlatmasını bekle
      await expect(incrementCache(key)).rejects.toThrow('Redis error');
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis increment hatası', { error: 'Redis error', key });
    });
  });
  
  describe('existsCache', () => {
    it('should check if a key exists in Redis', async () => {
      const key = 'test-key';
      
      // exists fonksiyonunu 1 döndürecek şekilde mock'la (anahtar var)
      require('../../../src/config/redis').redisClient.exists.mockResolvedValueOnce(1);
      
      const result = await existsCache(key);
      
      // redisClient.exists'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.exists).toHaveBeenCalledWith(key);
      
      // Sonucu doğrula
      expect(result).toBe(true);
    });
    
    it('should return false if key does not exist', async () => {
      const key = 'non-existent-key';
      
      // exists fonksiyonunu 0 döndürecek şekilde mock'la (anahtar yok)
      require('../../../src/config/redis').redisClient.exists.mockResolvedValueOnce(0);
      
      const result = await existsCache(key);
      
      // Sonucu doğrula
      expect(result).toBe(false);
    });
    
    it('should handle errors', async () => {
      const key = 'test-key';
      const error = new Error('Redis error');
      
      // exists fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.exists.mockRejectedValueOnce(error);
      
      const result = await existsCache(key);
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis exists hatası', { error: 'Redis error', key });
      
      // Hata durumunda false döndürülmeli
      expect(result).toBe(false);
    });
  });
  
  describe('getTTL', () => {
    it('should get TTL of a key from Redis', async () => {
      const key = 'test-key';
      const ttl = 3600;
      
      // ttl fonksiyonunu değer döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.ttl.mockResolvedValueOnce(ttl);
      
      const result = await getTTL(key);
      
      // redisClient.ttl'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.ttl).toHaveBeenCalledWith(key);
      
      // Sonucu doğrula
      expect(result).toBe(ttl);
    });
    
    it('should handle errors', async () => {
      const key = 'test-key';
      const error = new Error('Redis error');
      
      // ttl fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.ttl.mockRejectedValueOnce(error);
      
      const result = await getTTL(key);
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis TTL hatası', { error: 'Redis error', key });
      
      // Hata durumunda -2 döndürülmeli (anahtar bulunamadı)
      expect(result).toBe(-2);
    });
  });
  
  describe('setHashCache', () => {
    it('should set a hash field in Redis', async () => {
      const hashKey = 'hash-key';
      const field = 'field';
      const value = { name: 'test' };
      
      await setHashCache(hashKey, field, value);
      
      // redisClient.hset'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.hset)
        .toHaveBeenCalledWith(hashKey, field, JSON.stringify(value));
    });
    
    it('should set TTL if provided', async () => {
      const hashKey = 'hash-key';
      const field = 'field';
      const value = { name: 'test' };
      const ttl = 3600;
      
      await setHashCache(hashKey, field, value, ttl);
      
      // redisClient.expire'ın doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.expire).toHaveBeenCalledWith(hashKey, ttl);
    });
    
    it('should handle errors', async () => {
      const hashKey = 'hash-key';
      const field = 'field';
      const value = { name: 'test' };
      const error = new Error('Redis error');
      
      // hset fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.hset.mockRejectedValueOnce(error);
      
      // Hata fırlatmasını bekle
      await expect(setHashCache(hashKey, field, value)).rejects.toThrow('Redis error');
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis hash set hatası', { error: 'Redis error', hashKey, field });
    });
  });
  
  describe('getHashCache', () => {
    it('should get a hash field from Redis', async () => {
      const hashKey = 'hash-key';
      const field = 'field';
      const value = { name: 'test' };
      
      // hget fonksiyonunu değer döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.hget.mockResolvedValueOnce(JSON.stringify(value));
      
      const result = await getHashCache(hashKey, field);
      
      // redisClient.hget'in doğru parametrelerle çağrıldığını doğrula
      expect(require('../../../src/config/redis').redisClient.hget).toHaveBeenCalledWith(hashKey, field);
      
      // Sonucu doğrula
      expect(result).toEqual(value);
    });
    
    it('should return null if field does not exist', async () => {
      const hashKey = 'hash-key';
      const field = 'non-existent-field';
      
      // hget fonksiyonunu null döndürecek şekilde mock'la
      require('../../../src/config/redis').redisClient.hget.mockResolvedValueOnce(null);
      
      const result = await getHashCache(hashKey, field);
      
      // Sonucu doğrula
      expect(result).toBeNull();
    });
    
    it('should handle errors', async () => {
      const hashKey = 'hash-key';
      const field = 'field';
      const error = new Error('Redis error');
      
      // hget fonksiyonunu hata fırlatacak şekilde mock'la
      require('../../../src/config/redis').redisClient.hget.mockRejectedValueOnce(error);
      
      const result = await getHashCache(hashKey, field);
      
      // Hata loglandı mı?
      expect(logger.error).toHaveBeenCalledWith('Redis hash get hatası', { error: 'Redis error', hashKey, field });
      
      // Hata durumunda null döndürülmeli
      expect(result).toBeNull();
    });
  });
  
  describe('getCachedData', () => {
    it('should get data from cache if available', async () => {
      const key = 'cache-key';
      const cachedValue = { name: 'cached' };
      const fetchFunction = jest.fn().mockResolvedValue({ name: 'fetched' });
      
      // getCache fonksiyonunu değer döndürecek şekilde mock'la
      jest.spyOn(require('../../../src/config/redis'), 'getCache').mockResolvedValueOnce(cachedValue);
      
      const result = await getCachedData(key, fetchFunction);
      
      // fetchFunction çağrılmadı mı?
      expect(fetchFunction).not.toHaveBeenCalled();
      
      // Sonucu doğrula
      expect(result).toEqual(cachedValue);
    });
    
    it('should fetch data if not in cache', async () => {
      const key = 'cache-key';
      const fetchedValue = { name: 'fetched' };
      const fetchFunction = jest.fn().mockResolvedValue(fetchedValue);
      
      // getCache fonksiyonunu null döndürecek şekilde mock'la
      jest.spyOn(require('../../../src/config/redis'), 'getCache').mockResolvedValueOnce(null);
      
      const result = await getCachedData(key, fetchFunction);
      
      // fetchFunction çağrıldı mı?
      expect(fetchFunction).toHaveBeenCalled();
      
      // setCache çağrıldı mı?
      expect(require('../../../src/config/redis').setCache).toHaveBeenCalledWith(key, fetchedValue, 3600);
      
      // Sonucu doğrula
      expect(result).toEqual(fetchedValue);
    });
    
    it('should fetch data directly in development mode', async () => {
      const key = 'cache-key';
      const fetchedValue = { name: 'fetched' };
      const fetchFunction = jest.fn().mockResolvedValue(fetchedValue);
      
      // NODE_ENV'i development olarak ayarla
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const result = await getCachedData(key, fetchFunction);
      
      // fetchFunction çağrıldı mı?
      expect(fetchFunction).toHaveBeenCalled();
      
      // getCache çağrılmadı mı?
      expect(require('../../../src/config/redis').getCache).not.toHaveBeenCalled();
      
      // setCache çağrılmadı mı?
      expect(require('../../../src/config/redis').setCache).not.toHaveBeenCalled();
      
      // Sonucu doğrula
      expect(result).toEqual(fetchedValue);
      
      // NODE_ENV'i geri yükle
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle Redis errors and still fetch data', async () => {
      const key = 'cache-key';
      const fetchedValue = { name: 'fetched' };
      const fetchFunction = jest.fn().mockResolvedValue(fetchedValue);
      const error = new Error('Redis error');
      
      // getCache fonksiyonunu hata fırlatacak şekilde mock'la
      jest.spyOn(require('../../../src/config/redis'), 'getCache').mockRejectedValueOnce(error);
      
      const result = await getCachedData(key, fetchFunction);
      
      // Hata loglandı mı?
      expect(logger.warn).toHaveBeenCalledWith(`Redis önbellek hatası: ${error.message}`);
      
      // fetchFunction çağrıldı mı?
      expect(fetchFunction).toHaveBeenCalled();
      
      // Sonucu doğrula
      expect(result).toEqual(fetchedValue);
    });
    
    it('should handle fetch function errors', async () => {
      const key = 'cache-key';
      const error = new Error('Fetch error');
      const fetchFunction = jest.fn().mockRejectedValue(error);
      
      // getCache fonksiyonunu null döndürecek şekilde mock'la
      jest.spyOn(require('../../../src/config/redis'), 'getCache').mockResolvedValueOnce(null);
      
      // Hata fırlatmasını bekle
      await expect(getCachedData(key, fetchFunction)).rejects.toThrow('Fetch error');
    });
  });
});
