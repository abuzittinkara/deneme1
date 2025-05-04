/**
 * src/utils/debug.ts
 * Geliştirme modunda hata ayıklama yardımcıları
 */
import { logger } from './logger';

/**
 * Geliştirme modunda konsola ve loglara detaylı bilgi yazdırır
 * @param title - Başlık
 * @param data - Yazdırılacak veri
 */
export function debug(title: string, data: any): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log(`\n==== DEBUG: ${title} ====`);
  
  try {
    if (typeof data === 'object' && data !== null) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  } catch (error) {
    console.log('Veri JSON formatına dönüştürülemedi:', data);
  }
  
  console.log(`==== END DEBUG: ${title} ====\n`);
  
  // Ayrıca loglara da yaz
  logger.debug(`DEBUG: ${title}`, { metadata: { debugData: data } });
}

/**
 * Bir fonksiyonun çalışma süresini ölçer ve geliştirme modunda loglar
 * @param name - Fonksiyon adı
 * @param fn - Ölçülecek fonksiyon
 * @returns Fonksiyonun sonucu
 */
export async function measureTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    return fn();
  }

  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    
    logger.debug(`PERFORMANCE: ${name} - ${duration.toFixed(2)}ms`, {
      metadata: {
        operation: name,
        durationMs: duration
      }
    });
    
    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;
    
    logger.error(`PERFORMANCE ERROR: ${name} - ${duration.toFixed(2)}ms`, {
      metadata: {
        operation: name,
        durationMs: duration,
        error: (error as Error).message
      }
    });
    
    throw error;
  }
}

/**
 * Bir nesnenin bellek kullanımını tahmin eder
 * @param obj - Ölçülecek nesne
 * @returns Tahmini bellek kullanımı (byte)
 */
export function estimateObjectSize(obj: any): number {
  const objectList = new WeakSet();
  
  function sizeOf(value: any): number {
    if (value === null) return 0;
    
    const type = typeof value;
    if (type === 'boolean') return 4;
    if (type === 'number') return 8;
    if (type === 'string') return value.length * 2;
    if (type === 'object') {
      if (objectList.has(value)) return 0;
      
      objectList.add(value);
      
      let size = 0;
      
      if (Array.isArray(value)) {
        size = 40; // Array overhead
        for (const item of value) {
          size += sizeOf(item);
        }
      } else {
        size = 40; // Object overhead
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            size += key.length * 2; // Key size
            size += sizeOf(value[key]); // Value size
          }
        }
      }
      
      return size;
    }
    
    return 0;
  }
  
  return sizeOf(obj);
}

/**
 * Geliştirme modunda bellek kullanımını loglar
 */
export function logMemoryUsage(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  const memoryUsage = process.memoryUsage();
  
  logger.debug('Memory Usage', {
    metadata: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    }
  });
}

export default {
  debug,
  measureTime,
  estimateObjectSize,
  logMemoryUsage
};
