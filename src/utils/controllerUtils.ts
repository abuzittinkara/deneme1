/**
 * src/utils/controllerUtils.ts
 * Controller işlemleri için yardımcı fonksiyonlar
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Controller işleyici tipi
type AsyncControllerHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Async controller wrapper - try/catch bloğu ile hata yakalama
 * @param handler Asenkron controller işleyicisi
 * @returns Express middleware fonksiyonu
 */
export function asyncHandler(handler: AsyncControllerHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // İşlem başlangıç zamanı (performans izleme için)
      const startTime = Date.now();

      // İşleyiciyi çağır
      await handler(req, res, next);

      // İşlem süresini hesapla
      const duration = Date.now() - startTime;

      // Yavaş işlemleri logla (100ms'den uzun süren)
      if (duration > 100) {
        logger.debug('Yavaş controller işlemi', {
          path: req.path,
          method: req.method,
          duration: `${duration}ms`,
        });
      }
    } catch (error) {
      // Hatayı sonraki middleware'e ilet
      next(error);
    }
  };
}

/**
 * Standart başarılı yanıt
 * @param res Express yanıtı
 * @param data Yanıt verisi
 * @param statusCode HTTP durum kodu
 * @param meta Meta veriler (sayfalama, toplam sayı vb.)
 */
export function sendSuccess(res: Response, data: any, statusCode = 200, meta?: any) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

/**
 * Standart hata yanıtı
 * @param res Express yanıtı
 * @param message Hata mesajı
 * @param statusCode HTTP durum kodu
 * @param details Hata detayları
 */
export function sendError(res: Response, message: string, statusCode = 400, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(details && { details }),
    },
  });
}

/**
 * İstek parametrelerini doğrular
 * @param req Express isteği
 * @param requiredFields Zorunlu alanlar
 * @returns Hata varsa hata mesajı, yoksa null
 */
export function validateRequest(req: Request, requiredFields: string[]): string | null {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    // Nokta notasyonu ile iç içe alanları kontrol et (örn: "user.name")
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = req.body;

      for (const part of parts) {
        if (!value || value[part] === undefined) {
          missingFields.push(field);
          break;
        }
        value = value[part];
      }
    } else if (req.body[field] === undefined) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return `Eksik alanlar: ${missingFields.join(', ')}`;
  }

  return null;
}

export default {
  asyncHandler,
  sendSuccess,
  sendError,
  validateRequest,
};
