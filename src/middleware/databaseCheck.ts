/**
 * src/middleware/databaseCheck.ts
 * Veritabanı bağlantı durumu kontrolü için middleware
 */
import { Request, Response, NextFunction } from 'express';
import databaseService from '../services/databaseService';
import { logger } from '../utils/logger';

/**
 * Veritabanı bağlantısının hazır olup olmadığını kontrol eder
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function requireDatabaseConnection(req: Request, res: Response, next: NextFunction): void {
  if (!databaseService.isReady()) {
    logger.warn('Veritabanı bağlantısı hazır değil, istek reddedildi', {
      path: req.path,
      method: req.method,
    });

    res.status(503).json({
      success: false,
      error: {
        message: 'Veritabanı bağlantısı şu anda kullanılamıyor, lütfen daha sonra tekrar deneyin',
        statusCode: 503,
      },
    });
    return;
  }

  next();
}

/**
 * Veritabanı bağlantısını kontrol eder, hazır değilse uyarı loglar ama isteği engelleme
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function checkDatabaseConnection(req: Request, res: Response, next: NextFunction) {
  if (!databaseService.isReady()) {
    logger.warn('Veritabanı bağlantısı hazır değil, istek devam ediyor', {
      path: req.path,
      method: req.method,
    });

    // İsteğe veritabanı durumu ekle
    (req as any).databaseReady = false;
  } else {
    // İsteğe veritabanı durumu ekle
    (req as any).databaseReady = true;
  }

  next();
}

export default {
  requireDatabaseConnection,
  checkDatabaseConnection,
};
