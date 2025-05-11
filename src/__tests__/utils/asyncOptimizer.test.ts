/**
 * src/__tests__/utils/asyncOptimizer.test.ts
 * Asenkron işlemleri optimize etmek için yardımcı fonksiyonların testleri
 */
import {
  withTimeout,
  withRetry,
  withTimeoutAndRetry,
  parallelLimit,
  sequential,
  memoizeAsync,
} from '../../utils/asyncOptimizer';

describe('AsyncOptimizer', () => {
  // Jest'in zaman aşımı uyarılarını devre dışı bırak
  jest.setTimeout(10000);

  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const result = await withTimeout(Promise.resolve('success'), 1000);

      expect(result).toBe('success');
    });

    it('should reject when promise takes longer than timeout', async () => {
      // Güvenli bir şekilde Promise oluştur
      const testValue = 'slow';
      const slowPromise = new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve(testValue);
        }, 500);
        // Test için temizleme işlevi
        return () => clearTimeout(timeoutId);
      });

      await expect(withTimeout(slowPromise, 100, 'Custom timeout message')).rejects.toThrow(
        'Custom timeout message'
      );
    });
  });

  describe('withRetry', () => {
    it('should resolve on successful execution', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      // İlk iki çağrıda hata fırlat, üçüncüde başarılı ol
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        retries: 3,
        retryDelay: 100,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        withRetry(fn, {
          retries: 2,
          retryDelay: 100,
        })
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(3); // İlk deneme + 2 yeniden deneme
    });

    it('should call onRetry callback on each retry', async () => {
      const onRetry = jest.fn();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      await withRetry(fn, {
        retries: 3,
        retryDelay: 100,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
    });
  });

  describe('withTimeoutAndRetry', () => {
    it('should combine timeout and retry functionality', async () => {
      // İlk çağrıda zaman aşımına uğra, ikincide başarılı ol
      const fn = jest
        .fn()
        .mockImplementationOnce(() => {
          // Güvenli bir şekilde Promise oluştur
          const testValue = 'slow';
          return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              resolve(testValue);
            }, 200);
            // Test için temizleme işlevi
            return () => clearTimeout(timeoutId);
          });
        })
        .mockResolvedValue('success');

      const result = await withTimeoutAndRetry(fn, {
        timeout: 100,
        retries: 1,
        retryDelay: 50,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('parallelLimit', () => {
    it('should execute tasks in parallel with concurrency limit', async () => {
      const tasks = [
        jest.fn().mockResolvedValue('task1'),
        jest.fn().mockResolvedValue('task2'),
        jest.fn().mockResolvedValue('task3'),
        jest.fn().mockResolvedValue('task4'),
        jest.fn().mockResolvedValue('task5'),
      ];

      const results = await parallelLimit(tasks, 2);

      expect(results).toEqual(['task1', 'task2', 'task3', 'task4', 'task5']);
      tasks.forEach((task) => {
        expect(task).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle errors in tasks', async () => {
      const tasks = [
        jest.fn().mockResolvedValue('task1'),
        jest.fn().mockRejectedValue(new Error('Task 2 failed')),
        jest.fn().mockResolvedValue('task3'),
      ];

      await expect(parallelLimit(tasks, 1)).rejects.toThrow('Task 2 failed');
    });
  });

  describe('sequential', () => {
    it('should execute tasks sequentially', async () => {
      const order: number[] = [];
      const tasks = [
        jest.fn().mockImplementation(async () => {
          order.push(1);
          return 'task1';
        }),
        jest.fn().mockImplementation(async () => {
          order.push(2);
          return 'task2';
        }),
        jest.fn().mockImplementation(async () => {
          order.push(3);
          return 'task3';
        }),
      ];

      const results = await sequential(tasks);

      expect(results).toEqual(['task1', 'task2', 'task3']);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should stop execution on error', async () => {
      const tasks = [
        jest.fn().mockResolvedValue('task1'),
        jest.fn().mockRejectedValue(new Error('Task 2 failed')),
        jest.fn().mockResolvedValue('task3'),
      ];

      await expect(sequential(tasks)).rejects.toThrow('Task 2 failed');
      expect(tasks[0]).toHaveBeenCalled();
      expect(tasks[1]).toHaveBeenCalled();
      expect(tasks[2]).not.toHaveBeenCalled();
    });
  });

  describe('memoizeAsync', () => {
    it('should cache results for the same input', async () => {
      const fn = jest.fn().mockImplementation(async (a: number, b: number) => {
        return a + b;
      });

      const memoized = memoizeAsync(fn);

      // İlk çağrı
      expect(await memoized(1, 2)).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);

      // Aynı parametrelerle ikinci çağrı (önbellekten gelmeli)
      expect(await memoized(1, 2)).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1); // Hala 1 çağrı

      // Farklı parametrelerle çağrı
      expect(await memoized(2, 3)).toBe(5);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom key function', async () => {
      const fn = jest.fn().mockImplementation(async (obj: { id: number }) => {
        return obj.id * 2;
      });

      const memoized = memoizeAsync(fn, (obj) => `id:${obj.id}`);

      // İlk çağrı
      expect(await memoized({ id: 1 })).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);

      // Farklı nesne ama aynı id (önbellekten gelmeli)
      expect(await memoized({ id: 1 })).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);

      // Farklı id
      expect(await memoized({ id: 2 })).toBe(4);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect TTL', async () => {
      const fn = jest.fn().mockImplementation(async (x: number) => x * 2);

      const memoized = memoizeAsync(fn, undefined, 100); // 100ms TTL

      // İlk çağrı
      expect(await memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);

      // Hemen ikinci çağrı (önbellekten gelmeli)
      expect(await memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);

      // TTL süresini bekle
      await new Promise((resolve) => setTimeout(resolve, 150));

      // TTL sonrası çağrı (yeniden hesaplanmalı)
      expect(await memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
