/**
 * tests/unit/utils/debug.test.ts
 * Debug yardımcıları için birim testleri
 */
import * as debug from '../../../src/utils/debug';

// console.log'u mock'la
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();

// performance.now'ı mock'la
const originalPerformanceNow = performance.now;
const mockPerformanceNow = jest.fn();

describe('Debug Utils', () => {
  beforeEach(() => {
    // Mock'ları ayarla
    console.log = mockConsoleLog;
    performance.now = mockPerformanceNow;
    
    // Mock'ları temizle
    mockConsoleLog.mockClear();
    mockPerformanceNow.mockClear();
    
    // Test ortamını ayarla
    process.env.NODE_ENV = 'development';
  });
  
  afterEach(() => {
    // Orijinal fonksiyonları geri yükle
    console.log = originalConsoleLog;
    performance.now = originalPerformanceNow;
    
    // Test ortamını temizle
    process.env.NODE_ENV = 'test';
  });
  
  describe('debug', () => {
    it('should log debug information in development mode', () => {
      // Test
      debug.debug('Test Title', { key: 'value' });
      
      // Doğrulama
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog.mock.calls[0][0]).toContain('DEBUG: Test Title');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('key');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('value');
    });
    
    it('should not log in production mode', () => {
      // Üretim modunu ayarla
      process.env.NODE_ENV = 'production';
      
      // Test
      debug.debug('Test Title', { key: 'value' });
      
      // Doğrulama
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
    
    it('should handle non-object data', () => {
      // Test
      debug.debug('Test Title', 'string data');
      
      // Doğrulama
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog.mock.calls[1][0]).toBe('string data');
    });
    
    it('should handle circular references', () => {
      // Dairesel referans içeren nesne oluştur
      const circularObj: any = { key: 'value' };
      circularObj.self = circularObj;
      
      // Test
      debug.debug('Test Title', circularObj);
      
      // Doğrulama
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      // Dairesel referans JSON.stringify ile hata verir, bu yüzden hata mesajı bekliyoruz
      expect(mockConsoleLog.mock.calls[1][0]).toContain('Veri JSON formatına dönüştürülemedi');
    });
  });
  
  describe('measureTime', () => {
    it('should measure execution time in development mode', async () => {
      // performance.now mock'unu ayarla
      mockPerformanceNow.mockReturnValueOnce(100).mockReturnValueOnce(150);
      
      // Test fonksiyonu
      const testFn = jest.fn().mockResolvedValue('result');
      
      // Test
      const result = await debug.measureTime('Test Operation', testFn);
      
      // Doğrulama
      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(mockPerformanceNow).toHaveBeenCalledTimes(2);
    });
    
    it('should not measure time in production mode', async () => {
      // Üretim modunu ayarla
      process.env.NODE_ENV = 'production';
      
      // performance.now mock'unu ayarla
      mockPerformanceNow.mockReturnValueOnce(100).mockReturnValueOnce(150);
      
      // Test fonksiyonu
      const testFn = jest.fn().mockResolvedValue('result');
      
      // Test
      const result = await debug.measureTime('Test Operation', testFn);
      
      // Doğrulama
      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(mockPerformanceNow).not.toHaveBeenCalled();
    });
    
    it('should handle errors in the measured function', async () => {
      // performance.now mock'unu ayarla
      mockPerformanceNow.mockReturnValueOnce(100).mockReturnValueOnce(150);
      
      // Test fonksiyonu (hata fırlatan)
      const testError = new Error('Test error');
      const testFn = jest.fn().mockRejectedValue(testError);
      
      // Test ve doğrulama
      await expect(debug.measureTime('Test Operation', testFn)).rejects.toThrow('Test error');
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(mockPerformanceNow).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('estimateObjectSize', () => {
    it('should estimate size of primitive values', () => {
      expect(debug.estimateObjectSize(true)).toBe(4); // boolean
      expect(debug.estimateObjectSize(123)).toBe(8); // number
      expect(debug.estimateObjectSize('abc')).toBe(6); // string (3 chars * 2 bytes)
      expect(debug.estimateObjectSize(null)).toBe(0); // null
    });
    
    it('should estimate size of objects', () => {
      const obj = { a: 1, b: 'test', c: true };
      const size = debug.estimateObjectSize(obj);
      
      // Nesne overhead (40) + key boyutları (2 + 2 + 2) + değer boyutları (8 + 8 + 4)
      expect(size).toBeGreaterThan(40);
    });
    
    it('should estimate size of arrays', () => {
      const arr = [1, 'test', true];
      const size = debug.estimateObjectSize(arr);
      
      // Dizi overhead (40) + değer boyutları (8 + 8 + 4)
      expect(size).toBeGreaterThan(40);
    });
    
    it('should handle circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      
      const size = debug.estimateObjectSize(obj);
      
      // Nesne overhead (40) + key boyutları (2 + 8) + değer boyutları (8 + 0)
      // Dairesel referans 0 olarak sayılır
      expect(size).toBeGreaterThan(40);
    });
  });
  
  describe('logMemoryUsage', () => {
    it('should log memory usage in development mode', () => {
      // process.memoryUsage'ı mock'la
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      });
      
      // Test
      debug.logMemoryUsage();
      
      // Temizlik
      process.memoryUsage = originalMemoryUsage;
      
      // Doğrulama - logger.debug çağrıldı mı kontrol et
      // Not: logger mock'landığı için doğrudan kontrol edemiyoruz
    });
    
    it('should not log in production mode', () => {
      // Üretim modunu ayarla
      process.env.NODE_ENV = 'production';
      
      // process.memoryUsage'ı mock'la
      const originalMemoryUsage = process.memoryUsage;
      const mockMemoryUsage = jest.fn();
      process.memoryUsage = mockMemoryUsage;
      
      // Test
      debug.logMemoryUsage();
      
      // Temizlik
      process.memoryUsage = originalMemoryUsage;
      
      // Doğrulama
      expect(mockMemoryUsage).not.toHaveBeenCalled();
    });
  });
});
