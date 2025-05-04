/**
 * src/__tests__/utils/memoryOptimizer.test.ts
 * Bellek kullanımını optimize etmek için yardımcı fonksiyonların testleri
 */
import {
  formatMemoryUsage,
  getMemoryUsage,
  logMemoryUsage,
  monitorMemoryUsage,
  detectMemoryLeaks,
  cleanupLargeObject
} from '../../utils/memoryOptimizer';
import { logger } from '../../utils/logger';

// Logger'ı mock'la
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MemoryOptimizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('formatMemoryUsage', () => {
    it('should format bytes correctly', () => {
      expect(formatMemoryUsage(512)).toBe('512.00 B');
      expect(formatMemoryUsage(1024)).toBe('1.00 KB');
      expect(formatMemoryUsage(1536)).toBe('1.50 KB');
      expect(formatMemoryUsage(1048576)).toBe('1.00 MB');
      expect(formatMemoryUsage(1073741824)).toBe('1.00 GB');
    });
  });
  
  describe('getMemoryUsage', () => {
    it('should return memory usage object', () => {
      const memoryUsage = getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('rss');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('arrayBuffers');
      
      expect(typeof memoryUsage.rss).toBe('number');
      expect(typeof memoryUsage.heapTotal).toBe('number');
      expect(typeof memoryUsage.heapUsed).toBe('number');
      expect(typeof memoryUsage.external).toBe('number');
      expect(typeof memoryUsage.arrayBuffers).toBe('number');
    });
  });
  
  describe('logMemoryUsage', () => {
    it('should log memory usage with default label', () => {
      logMemoryUsage();
      
      expect(logger.info).toHaveBeenCalledWith('Bellek Kullanımı:', expect.objectContaining({
        rss: expect.any(String),
        heapTotal: expect.any(String),
        heapUsed: expect.any(String),
        external: expect.any(String),
        arrayBuffers: expect.any(String)
      }));
    });
    
    it('should log memory usage with custom label', () => {
      logMemoryUsage('Test Label');
      
      expect(logger.info).toHaveBeenCalledWith('Test Label:', expect.objectContaining({
        rss: expect.any(String),
        heapTotal: expect.any(String),
        heapUsed: expect.any(String),
        external: expect.any(String),
        arrayBuffers: expect.any(String)
      }));
    });
  });
  
  describe('monitorMemoryUsage', () => {
    it('should set up interval and return stop function', () => {
      // setInterval'ı mock'la
      jest.useFakeTimers();
      
      const stopMonitoring = monitorMemoryUsage(1024, 60000);
      
      expect(typeof stopMonitoring).toBe('function');
      
      // Interval'ı tetikle
      jest.advanceTimersByTime(60000);
      
      // Bellek kullanımı eşiğin altındaysa uyarı loglanmamalı
      expect(logger.warn).not.toHaveBeenCalled();
      
      // İzlemeyi durdur
      stopMonitoring();
      
      // Bir interval daha tetikle
      jest.advanceTimersByTime(60000);
      
      // İzleme durdurulduğu için logger çağrılmamalı
      expect(logger.info).toHaveBeenCalledTimes(0);
      
      jest.useRealTimers();
    });
  });
  
  describe('detectMemoryLeaks', () => {
    it('should set up interval and return stop function', () => {
      // setInterval'ı mock'la
      jest.useFakeTimers();
      
      const stopDetecting = detectMemoryLeaks(60000, 5);
      
      expect(typeof stopDetecting).toBe('function');
      
      // İzlemeyi durdur
      stopDetecting();
      
      jest.useRealTimers();
    });
  });
  
  describe('cleanupLargeObject', () => {
    it('should clean up object properties', () => {
      const obj = {
        prop1: 'value1',
        prop2: 'value2',
        nested: {
          nestedProp: 'nestedValue'
        }
      };
      
      cleanupLargeObject(obj);
      
      expect(Object.keys(obj).length).toBe(0);
      expect(obj.prop1).toBeUndefined();
      expect(obj.prop2).toBeUndefined();
      expect(obj.nested).toBeUndefined();
    });
    
    it('should handle non-object values', () => {
      // Primitive değerler için hata vermemeli
      expect(() => cleanupLargeObject(null)).not.toThrow();
      expect(() => cleanupLargeObject(undefined)).not.toThrow();
      expect(() => cleanupLargeObject(123)).not.toThrow();
      expect(() => cleanupLargeObject('string')).not.toThrow();
      expect(() => cleanupLargeObject(true)).not.toThrow();
    });
  });
});
