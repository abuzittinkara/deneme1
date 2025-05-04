/**
 * src/utils/memoryOptimizer.ts
 * Bellek kullanımını optimize etmek için yardımcı fonksiyonlar
 */
import { logger } from './logger';

/**
 * Bellek kullanım bilgileri
 */
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Bellek kullanımını formatlar
 * 
 * @param bytes - Bayt cinsinden bellek kullanımı
 * @returns Formatlanmış bellek kullanımı
 */
export function formatMemoryUsage(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Mevcut bellek kullanımını getirir
 * 
 * @returns Bellek kullanım bilgileri
 */
export function getMemoryUsage(): MemoryUsage {
  const memoryUsage = process.memoryUsage();
  
  return {
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed,
    external: memoryUsage.external,
    arrayBuffers: memoryUsage.arrayBuffers || 0
  };
}

/**
 * Bellek kullanımını loglar
 * 
 * @param label - Log etiketi
 */
export function logMemoryUsage(label: string = 'Bellek Kullanımı'): void {
  const memoryUsage = getMemoryUsage();
  
  logger.info(`${label}:`, {
    rss: formatMemoryUsage(memoryUsage.rss),
    heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
    heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
    external: formatMemoryUsage(memoryUsage.external),
    arrayBuffers: formatMemoryUsage(memoryUsage.arrayBuffers)
  });
}

/**
 * Bellek kullanımını izler ve belirli bir eşiği aşarsa uyarı verir
 * 
 * @param thresholdMB - Eşik değeri (MB)
 * @param interval - Kontrol aralığı (ms)
 * @returns İzleme işlemini durduran fonksiyon
 */
export function monitorMemoryUsage(thresholdMB: number = 1024, interval: number = 60000): () => void {
  const thresholdBytes = thresholdMB * 1024 * 1024;
  
  const timer = setInterval(() => {
    const memoryUsage = getMemoryUsage();
    
    if (memoryUsage.heapUsed > thresholdBytes) {
      logger.warn('Yüksek bellek kullanımı tespit edildi', {
        heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
        threshold: formatMemoryUsage(thresholdBytes)
      });
      
      // Bellek kullanımını azaltmak için çöp toplama işlemini zorla
      if (global.gc) {
        logger.info('Çöp toplama işlemi zorlanıyor');
        global.gc();
      } else {
        logger.info('Çöp toplama işlemi zorlanamıyor. Node.js\'i --expose-gc parametresi ile başlatın');
      }
    }
  }, interval);
  
  // İzleme işlemini durduran fonksiyonu döndür
  return () => {
    clearInterval(timer);
  };
}

/**
 * Bellek sızıntılarını tespit etmek için bellek kullanımını izler
 * 
 * @param interval - Kontrol aralığı (ms)
 * @param samples - Örnek sayısı
 * @returns İzleme işlemini durduran fonksiyon
 */
export function detectMemoryLeaks(interval: number = 60000, samples: number = 5): () => void {
  const memoryUsageHistory: number[] = [];
  
  const timer = setInterval(() => {
    const memoryUsage = getMemoryUsage();
    memoryUsageHistory.push(memoryUsage.heapUsed);
    
    // Sadece belirli sayıda örnek sakla
    if (memoryUsageHistory.length > samples) {
      memoryUsageHistory.shift();
    }
    
    // En az 3 örnek varsa bellek sızıntısı kontrolü yap
    if (memoryUsageHistory.length >= 3) {
      const increasing = memoryUsageHistory.every((value, index, array) => {
        return index === 0 || value > array[index - 1];
      });
      
      if (increasing) {
        logger.warn('Olası bellek sızıntısı tespit edildi', {
          memoryUsageHistory: memoryUsageHistory.map(formatMemoryUsage)
        });
      }
    }
  }, interval);
  
  // İzleme işlemini durduran fonksiyonu döndür
  return () => {
    clearInterval(timer);
  };
}

/**
 * Bellek kullanımını optimize etmek için büyük nesneleri temizler
 * 
 * @param obj - Temizlenecek nesne
 */
export function cleanupLargeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  // Nesnenin tüm özelliklerini temizle
  Object.keys(obj).forEach(key => {
    delete obj[key];
  });
  
  // Nesneyi null olarak ayarla
  Object.setPrototypeOf(obj, null);
}

export default {
  formatMemoryUsage,
  getMemoryUsage,
  logMemoryUsage,
  monitorMemoryUsage,
  detectMemoryLeaks,
  cleanupLargeObject
};
