/**
 * tests/unit/config/environment.test.ts
 * Çevre değişkenleri yardımcıları için birim testleri
 */
import {
  isDevelopment,
  isTest,
  isProduction,
  getEnv,
  getEnvNumber,
  getEnvBoolean,
  getEnvArray
} from '../../../src/config/environment';

describe('Environment Utils', () => {
  // Orijinal process.env'i yedekle
  const originalEnv = process.env;
  
  beforeEach(() => {
    // process.env'i sıfırla
    process.env = { ...originalEnv };
    
    // Test için çevre değişkenlerini temizle
    delete process.env.NODE_ENV;
    delete process.env.TEST_STRING;
    delete process.env.TEST_NUMBER;
    delete process.env.TEST_BOOLEAN;
    delete process.env.TEST_ARRAY;
  });
  
  afterAll(() => {
    // Orijinal process.env'i geri yükle
    process.env = originalEnv;
  });
  
  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
      expect(isTest()).toBe(false);
      expect(isProduction()).toBe(false);
    });
    
    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(true);
      expect(isProduction()).toBe(false);
    });
    
    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(false);
      expect(isProduction()).toBe(true);
    });
    
    it('should handle undefined environment', () => {
      delete process.env.NODE_ENV;
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(false);
      expect(isProduction()).toBe(false);
    });
  });
  
  describe('getEnv', () => {
    it('should return environment variable value', () => {
      process.env.TEST_STRING = 'test-value';
      expect(getEnv('TEST_STRING')).toBe('test-value');
    });
    
    it('should return default value if environment variable is not set', () => {
      expect(getEnv('TEST_STRING', 'default-value')).toBe('default-value');
    });
    
    it('should return empty string if environment variable is not set and no default value is provided', () => {
      expect(getEnv('TEST_STRING')).toBe('');
    });
  });
  
  describe('getEnvNumber', () => {
    it('should return environment variable value as number', () => {
      process.env.TEST_NUMBER = '123';
      expect(getEnvNumber('TEST_NUMBER')).toBe(123);
    });
    
    it('should return default value if environment variable is not set', () => {
      expect(getEnvNumber('TEST_NUMBER', 456)).toBe(456);
    });
    
    it('should return default value if environment variable is not a valid number', () => {
      process.env.TEST_NUMBER = 'not-a-number';
      expect(getEnvNumber('TEST_NUMBER', 789)).toBe(789);
    });
    
    it('should return 0 if environment variable is not set and no default value is provided', () => {
      expect(getEnvNumber('TEST_NUMBER')).toBe(0);
    });
  });
  
  describe('getEnvBoolean', () => {
    it('should return true for "true" string', () => {
      process.env.TEST_BOOLEAN = 'true';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(true);
    });
    
    it('should return false for "false" string', () => {
      process.env.TEST_BOOLEAN = 'false';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });
    
    it('should return false for any other string', () => {
      process.env.TEST_BOOLEAN = 'yes';
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });
    
    it('should return default value if environment variable is not set', () => {
      expect(getEnvBoolean('TEST_BOOLEAN', true)).toBe(true);
    });
    
    it('should return false if environment variable is not set and no default value is provided', () => {
      expect(getEnvBoolean('TEST_BOOLEAN')).toBe(false);
    });
  });
  
  describe('getEnvArray', () => {
    it('should return environment variable value as array', () => {
      process.env.TEST_ARRAY = 'a,b,c';
      expect(getEnvArray('TEST_ARRAY')).toEqual(['a', 'b', 'c']);
    });
    
    it('should trim array items', () => {
      process.env.TEST_ARRAY = 'a, b, c';
      expect(getEnvArray('TEST_ARRAY')).toEqual(['a', 'b', 'c']);
    });
    
    it('should use custom separator', () => {
      process.env.TEST_ARRAY = 'a|b|c';
      expect(getEnvArray('TEST_ARRAY', '|')).toEqual(['a', 'b', 'c']);
    });
    
    it('should return default value if environment variable is not set', () => {
      expect(getEnvArray('TEST_ARRAY', ',', ['d', 'e', 'f'])).toEqual(['d', 'e', 'f']);
    });
    
    it('should return empty array if environment variable is not set and no default value is provided', () => {
      expect(getEnvArray('TEST_ARRAY')).toEqual([]);
    });
  });
});
