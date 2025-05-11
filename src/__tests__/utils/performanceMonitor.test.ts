/**
 * src/__tests__/utils/performanceMonitor.test.ts
 * Performans izleme yardımcı fonksiyonlarının testleri
 */
import {
  measure,
  measureSync,
  getRecentMeasurements,
  getAverageDuration,
  generatePerformanceReport,
} from '../../utils/performanceMonitor';

describe('Performance Monitor', () => {
  describe('measureSync', () => {
    it('should measure synchronous function execution time', () => {
      const result = measureSync('test-sync', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500);
    });

    it('should handle errors in synchronous functions', () => {
      const testError = new Error('Test error');

      expect(() => {
        measureSync('test-sync-error', () => {
          throw testError;
        });
      }).toThrow(testError);
    });
  });

  describe('measure', () => {
    it('should measure asynchronous function execution time', async () => {
      const result = await measure('test-async', async () => {
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(42);
          }, 10);
        });
      });

      expect(result).toBe(42);
    });

    it('should handle errors in asynchronous functions', async () => {
      const testError = new Error('Test async error');

      await expect(
        measure('test-async-error', async () => {
          return new Promise<number>((_, reject) => {
            setTimeout(() => {
              reject(testError);
            }, 10);
          });
        })
      ).rejects.toThrow(testError);
    });
  });

  describe('getRecentMeasurements', () => {
    it('should return recent measurements', async () => {
      // Perform some measurements
      measureSync('test-recent-1', () => 1);
      measureSync('test-recent-2', () => 2);
      await measure('test-recent-3', async () => 3);

      const measurements = getRecentMeasurements();

      expect(measurements.length).toBeGreaterThanOrEqual(3);
      expect(measurements[measurements.length - 3].name).toBe('test-recent-1');
      expect(measurements[measurements.length - 2].name).toBe('test-recent-2');
      expect(measurements[measurements.length - 1].name).toBe('test-recent-3');
    });

    it('should respect the limit parameter', () => {
      // Perform some measurements
      for (let i = 0; i < 10; i++) {
        measureSync(`test-limit-${i}`, () => i);
      }

      const measurements = getRecentMeasurements(5);

      expect(measurements.length).toBe(5);
      expect(measurements[0].name).toBe('test-limit-5');
      expect(measurements[4].name).toBe('test-limit-9');
    });
  });

  describe('getAverageDuration', () => {
    it('should calculate average duration for a specific operation', () => {
      // Perform multiple measurements of the same operation
      const operationName = 'test-average';

      for (let i = 0; i < 5; i++) {
        measureSync(operationName, () => {
          let sum = 0;
          for (let j = 0; j < 1000; j++) {
            sum += j;
          }
          return sum;
        });
      }

      const average = getAverageDuration(operationName);

      expect(average).toBeGreaterThan(0);
    });

    it('should return 0 for unknown operations', () => {
      const average = getAverageDuration('unknown-operation');

      expect(average).toBe(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate a performance report', () => {
      // Perform some measurements
      measureSync('test-report-1', () => 1);
      measureSync('test-report-2', () => 2);

      const report = generatePerformanceReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('measurements');
      expect(report).toHaveProperty('operations');
      expect(report).toHaveProperty('memory');
      expect(report.measurements.total).toBeGreaterThanOrEqual(2);
    });
  });
});
