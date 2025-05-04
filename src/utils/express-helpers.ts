/**
 * src/utils/express-helpers.ts
 * Express middleware işlemleri için yardımcı fonksiyonlar
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest, AuthUser } from '../types/express';

/**
 * Express middleware'ini tip güvenli hale getiren yardımcı fonksiyon
 * @param middleware - Express middleware'i
 * @returns Tip güvenli middleware
 */
export function createMiddlewareHelper<ReqType extends Request = Request>(
  middleware: (req: ReqType, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await middleware(req as ReqType, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Kimlik doğrulama middleware'ini tip güvenli hale getiren yardımcı fonksiyon
 * @param middleware - Kimlik doğrulama middleware'i
 * @returns Tip güvenli middleware
 */
export function createAuthMiddleware(
  middleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await middleware(req as AuthRequest, res, next);
    } catch (error) {
      next(error);
    }
  };
}

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
          code: 'UNAUTHORIZED'
        });
        return;
      }

      await handler(authReq, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express route handler'ını async/await ile sarmalayan yardımcı fonksiyon
 * @param fn - Async fonksiyon
 * @returns Express middleware
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  createMiddlewareHelper,
  createAuthMiddleware,
  createRouteHandler,
  createAuthRouteHandler,
  asyncHandler
};
