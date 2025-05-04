/**
 * src/middleware/errorTracker.ts
 * Hata izleme ve raporlama middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import sentryHandler from './sentryHandler';

// Hata sayaçları
const errorCounts: Record<string, { count: number, firstSeen: Date, lastSeen: Date }> = {};

/**
 * Hataları izler ve tekrarlayan hataları tespit eder
 * @param err Hata nesnesi
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function trackErrors(err: any, req: Request, res: Response, next: NextFunction) {
  try {
    // Hata parmak izi oluştur
    const errorName = err.name || 'UnknownError';
    const errorMessage = err.message || 'Bilinmeyen hata';
    const errorFingerprint = `${errorName}:${errorMessage}`;
    
    // Hata sayacını güncelle
    if (!errorCounts[errorFingerprint]) {
      errorCounts[errorFingerprint] = { 
        count: 0, 
        firstSeen: new Date(), 
        lastSeen: new Date() 
      };
    }
    
    errorCounts[errorFingerprint].count++;
    errorCounts[errorFingerprint].lastSeen = new Date();
    
    // Tekrarlayan hataları tespit et
    if (errorCounts[errorFingerprint].count > 10) {
      const timeDiff = errorCounts[errorFingerprint].lastSeen.getTime() - 
                      errorCounts[errorFingerprint].firstSeen.getTime();
      
      // Son 5 dakika içinde 10'dan fazla aynı hata
      if (timeDiff < 5 * 60 * 1000) {
        logger.error('Tekrarlayan hata tespit edildi', { 
          error: errorMessage, 
          name: errorName,
          count: errorCounts[errorFingerprint].count,
          timeSpan: `${Math.round(timeDiff / 1000)} saniye`
        });
        
        // Sentry'ye bildir
        sentryHandler.sentryReportError(err, { 
          context: 'Repeated Error', 
          fingerprint: errorFingerprint,
          count: errorCounts[errorFingerprint].count
        });
      }
    }
  } catch (trackingError) {
    // Hata izleme sırasında hata oluşursa, orijinal hatayı etkilememesi için yakala
    logger.error('Hata izleme sırasında hata oluştu', { 
      error: (trackingError as Error).message 
    });
  }
  
  // Orijinal hatayı sonraki middleware'e ilet
  next(err);
}

/**
 * Hata sayaçlarını temizler (belirli aralıklarla çağrılmalı)
 */
export function clearErrorCounts(): void {
  // 1 saatten eski hata sayaçlarını temizle
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  Object.keys(errorCounts).forEach(key => {
    const lastSeen = errorCounts[key].lastSeen.getTime();
    if (now - lastSeen > oneHour) {
      delete errorCounts[key];
    }
  });
  
  logger.debug('Hata sayaçları temizlendi', { 
    remainingCount: Object.keys(errorCounts).length 
  });
}

// Periyodik temizleme
setInterval(clearErrorCounts, 30 * 60 * 1000); // 30 dakikada bir

export default {
  trackErrors,
  clearErrorCounts
};
