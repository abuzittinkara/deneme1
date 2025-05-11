/**
 * src/utils/asyncHandler.ts
 * Asenkron işlemleri yönetmek için yardımcı fonksiyon
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Express route handler'ları için asenkron işlemleri yönetir
 *
 * @param fn - Asenkron route handler fonksiyonu
 * @returns Express middleware fonksiyonu
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Asenkron işlem hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
      });

      next(error);
    });
  };
};

export default asyncHandler;
