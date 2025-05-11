/**
 * src/utils/routeHandler.ts
 * Express route handler'ları için yardımcı fonksiyonlar
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from '../types/express';
import { logger } from './logger';

/**
 * Express route handler'ını tip güvenli hale getiren yardımcı fonksiyon
 * @param handler - Express route handler'ı
 * @returns Tip güvenli route handler
 */
export function createRouteHandler<ReqType extends Request = Request>(
  handler: (req: ReqType, res: Response, next?: NextFunction) => Promise<any> | any
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req as ReqType, res, next);
    } catch (error) {
      logger.error('Route handler hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        path: req.path,
        method: req.method,
      });
      next(error);
    }
  };
}

/**
 * Kimlik doğrulama gerektiren route handler'ını tip güvenli hale getiren yardımcı fonksiyon
 * @param handler - Kimlik doğrulama gerektiren route handler'ı
 * @returns Tip güvenli route handler
 */
export function createAuthRouteHandler(
  handler: (req: AuthRequest, res: Response, next?: NextFunction) => Promise<any> | any
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Kullanıcı kimliği doğrulanmış mı kontrol et
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        res.status(401).json({
          success: false,
          message: 'Kimlik doğrulama gerekli',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      await handler(authReq, res, next);
    } catch (error) {
      logger.error('Auth route handler hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        path: req.path,
        method: req.method,
        userId: (req as AuthRequest).user?.id,
      });
      next(error);
    }
  };
}

export default {
  createRouteHandler,
  createAuthRouteHandler,
};
