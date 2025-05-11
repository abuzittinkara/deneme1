/**
 * src/utils/asyncOptimizer.ts
 * Asenkron işlemleri optimize etmek için yardımcı fonksiyonlar
 */
import { logger } from './logger';

/**
 * Asenkron işlem seçenekleri
 */
export interface AsyncOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Asenkron işlemi zaman aşımı ile çalıştırır
 *
 * @param promise - Asenkron işlem
 * @param ms - Zaman aşımı süresi (ms)
 * @param errorMessage - Hata mesajı
 * @returns Asenkron işlem sonucu
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = 'İşlem zaman aşımına uğradı'
): Promise<T> {
  // Zaman aşımı promise'i
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });

  // Promise.race ile ilk tamamlanan promise'i döndür
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Asenkron işlemi yeniden deneme ile çalıştırır
 *
 * @param fn - Asenkron işlem fonksiyonu
 * @param options - Yeniden deneme seçenekleri
 * @returns Asenkron işlem sonucu
 */
export async function withRetry<T>(fn: () => Promise<T>, options: AsyncOptions = {}): Promise<T> {
  const retries = options.retries || 3;
  const retryDelay = options.retryDelay || 1000;
  const onRetry =
    options.onRetry ||
    ((error, attempt) => {
      logger.warn(`İşlem başarısız oldu, yeniden deneniyor (${attempt}/${retries})`, {
        error: error.message,
        attempt,
        retries,
      });
    });

  let lastError: Error;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // İşlemi çalıştır
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Son deneme değilse yeniden dene
      if (attempt <= retries) {
        onRetry(lastError, attempt);

        // Yeniden denemeden önce bekle
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Tüm denemeler başarısız oldu
  throw lastError!;
}

/**
 * Asenkron işlemi hem zaman aşımı hem de yeniden deneme ile çalıştırır
 *
 * @param fn - Asenkron işlem fonksiyonu
 * @param options - Asenkron işlem seçenekleri
 * @returns Asenkron işlem sonucu
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  options: AsyncOptions = {}
): Promise<T> {
  const timeout = options.timeout || 10000;

  return withRetry(() => withTimeout(fn(), timeout), options);
}

/**
 * Asenkron işlemleri paralel olarak çalıştırır ve sonuçları döndürür
 *
 * @param tasks - Asenkron işlemler
 * @param concurrency - Eşzamanlı işlem sayısı
 * @returns Asenkron işlem sonuçları
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  const taskQueue = [...tasks];

  // Tüm görevler tamamlanana kadar döngüyü sürdür
  while (taskQueue.length > 0 || executing.length > 0) {
    // Eşzamanlı işlem sayısı sınırına ulaşılmadıysa yeni görevler başlat
    while (taskQueue.length > 0 && executing.length < concurrency) {
      const task = taskQueue.shift()!;
      const index = results.length;

      // Sonuçlar dizisinde yer ayır
      results.push(undefined as any);

      // Görevi çalıştır ve tamamlandığında executing dizisinden çıkar
      const promise = task()
        .then((result) => {
          results[index] = result;
          executing.splice(executing.indexOf(promise), 1);
        })
        .catch((error) => {
          logger.error('Paralel görev hatası', {
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            index,
          });

          executing.splice(executing.indexOf(promise), 1);
          throw error;
        });

      executing.push(promise);
    }

    // Herhangi bir görev tamamlanana kadar bekle
    if (executing.length > 0) {
      await Promise.race(executing).catch(() => {});
    }
  }

  return results;
}

/**
 * Asenkron işlemleri sırayla çalıştırır ve sonuçları döndürür
 *
 * @param tasks - Asenkron işlemler
 * @returns Asenkron işlem sonuçları
 */
export async function sequential<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    try {
      const result = await task();
      results.push(result);
    } catch (error) {
      logger.error('Sıralı görev hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        index: results.length,
      });

      throw error;
    }
  }

  return results;
}

/**
 * Asenkron işlemi önbellek ile çalıştırır
 *
 * @param fn - Asenkron işlem fonksiyonu
 * @param keyFn - Önbellek anahtarı oluşturan fonksiyon
 * @param ttl - Önbellek süresi (ms)
 * @returns Önbellekli asenkron işlem fonksiyonu
 */
export function memoizeAsync<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  keyFn: (...args: A) => string = (...args) => JSON.stringify(args),
  ttl: number = 60000
): (...args: A) => Promise<T> {
  const cache = new Map<string, { value: T; timestamp: number }>();

  return async (...args: A): Promise<T> => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    const now = Date.now();

    // Önbellekte varsa ve süresi dolmamışsa önbellekten döndür
    if (cached && now - cached.timestamp < ttl) {
      return cached.value;
    }

    // Önbellekte yoksa veya süresi dolmuşsa işlemi çalıştır
    const value = await fn(...args);

    // Sonucu önbelleğe ekle
    cache.set(key, { value, timestamp: now });

    return value;
  };
}

export default {
  withTimeout,
  withRetry,
  withTimeoutAndRetry,
  parallelLimit,
  sequential,
  memoizeAsync,
};
