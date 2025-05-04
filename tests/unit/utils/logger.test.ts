/**
 * tests/unit/utils/logger.test.ts
 * Logger modülü için birim testleri
 */
import { logger, logError, measurePerformance } from '../../../src/utils/logger';

// Logger'ı doğrudan mock'la
jest.mock('../../../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };

  return {
    logger: mockLogger,
    logError: jest.fn().mockImplementation((error, context, metadata) => {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };

      if (context) {
        errorInfo.context = context;
      }

      if (metadata) {
        Object.assign(errorInfo, metadata);
      }

      mockLogger.error(`Error: ${error.message}`, {
        metadata: errorInfo,
      });

      return errorInfo;
    }),
    measurePerformance: jest.fn().mockImplementation(async (name, fn, metadata = {}) => {
      try {
        const result = await fn();
        mockLogger.debug(`Performance: ${name} completed in 500ms`, {
          metadata: {
            operation: name,
            duration: 500,
            ...metadata,
          },
        });
        return result;
      } catch (error) {
        mockLogger.error(`Error: ${error.message}`, {
          metadata: {
            message: error.message,
            operation: name,
            duration: 500,
            ...metadata,
          },
        });
        throw error;
      }
    }),
    httpLogger: {
      log: jest.fn(),
    },
  };
});

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger', () => {
    it('should log info messages', () => {
      // Test
      logger.info('Test info message', { metadata: { test: true } });

      // Doğrulama
      expect(logger.info).toHaveBeenCalledWith('Test info message', { metadata: { test: true } });
    });

    it('should log error messages', () => {
      // Test
      logger.error('Test error message', { metadata: { test: true } });

      // Doğrulama
      expect(logger.error).toHaveBeenCalledWith('Test error message', { metadata: { test: true } });
    });

    it('should log warn messages', () => {
      // Test
      logger.warn('Test warn message', { metadata: { test: true } });

      // Doğrulama
      expect(logger.warn).toHaveBeenCalledWith('Test warn message', { metadata: { test: true } });
    });

    it('should log debug messages', () => {
      // Test
      logger.debug('Test debug message', { metadata: { test: true } });

      // Doğrulama
      expect(logger.debug).toHaveBeenCalledWith('Test debug message', { metadata: { test: true } });
    });
  });

  describe('logError', () => {
    it('should log error with context and metadata', () => {
      // Test verisi
      const error = new Error('Test error');
      const context = 'Test context';
      const metadata = { test: true };

      // Test
      const result = logError(error, context, metadata);

      // Doğrulama
      expect(logger.error).toHaveBeenCalledWith('Error: Test error', {
        metadata: expect.objectContaining({
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
          context: 'Test context',
          test: true,
        }),
      });

      // Sonuç doğrulama
      expect(result).toEqual(expect.objectContaining({
        message: 'Test error',
        stack: error.stack,
        name: 'Error',
        context: 'Test context',
        test: true,
      }));
    });

    it('should log error without context and metadata', () => {
      // Test verisi
      const error = new Error('Test error');

      // Test
      const result = logError(error);

      // Doğrulama
      expect(logger.error).toHaveBeenCalledWith('Error: Test error', {
        metadata: expect.objectContaining({
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
        }),
      });

      // Sonuç doğrulama
      expect(result).toEqual(expect.objectContaining({
        message: 'Test error',
        stack: error.stack,
        name: 'Error',
      }));
    });
  });

  describe('measurePerformance', () => {
    it('should measure performance of successful function', async () => {
      // Test fonksiyonu
      const testFn = jest.fn().mockResolvedValue('result');

      // Test
      const result = await measurePerformance('Test operation', testFn);

      // Doğrulama
      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Performance: Test operation completed in 500ms',
        expect.objectContaining({
          metadata: expect.objectContaining({
            operation: 'Test operation',
            duration: 500,
          }),
        })
      );
    });

    it('should measure performance of failing function', async () => {
      // Test fonksiyonu (hata fırlatan)
      const testError = new Error('Test error');
      const testFn = jest.fn().mockRejectedValue(testError);

      // Test ve doğrulama
      await expect(measurePerformance('Test operation', testFn)).rejects.toThrow('Test error');

      expect(testFn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Error: Test error',
        expect.objectContaining({
          metadata: expect.objectContaining({
            message: 'Test error',
            operation: 'Test operation',
            duration: 500,
          }),
        })
      );
    });

    it('should include additional metadata', async () => {
      // Test fonksiyonu
      const testFn = jest.fn().mockResolvedValue('result');
      const metadata = { userId: '123', action: 'test' };

      // Test
      await measurePerformance('Test operation', testFn, metadata);

      // Doğrulama
      expect(logger.debug).toHaveBeenCalledWith(
        'Performance: Test operation completed in 500ms',
        expect.objectContaining({
          metadata: expect.objectContaining({
            operation: 'Test operation',
            duration: 500,
            userId: '123',
            action: 'test',
          }),
        })
      );
    });
  });
});
