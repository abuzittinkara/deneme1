/**
 * src/utils/middleware-chain.ts
 * Tip güvenli middleware zinciri
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from '../types/express';

/**
 * Tip güvenli middleware zinciri oluşturur
 * @param middlewares - Zincirlenecek middleware'ler
 * @returns Express request handler
 */
export function createMiddlewareChain<ReqType extends Request = Request>(
  ...middlewares: Array<(req: ReqType, res: Response, next: NextFunction) => Promise<void> | void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const typedReq = req as ReqType;

      // Middleware'leri sırayla çalıştır
      for (const middleware of middlewares) {
        // Yanıt gönderilmişse zinciri durdur
        if (res.headersSent) {
          return;
        }

        // Middleware'i çalıştır
        await new Promise<void>((resolve, reject) => {
          try {
            const result = middleware(typedReq, res, (err?: any) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });

            // Eğer middleware bir Promise döndürüyorsa, onu bekle
            if (result instanceof Promise) {
              result.then(() => resolve()).catch(err => reject(err));
            }
          } catch (error) {
            reject(error);
          }
        });
      }

      // Tüm middleware'ler başarıyla çalıştıysa ve yanıt gönderilmediyse next'i çağır
      if (!res.headersSent) {
        next();
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Kimlik doğrulama gerektiren middleware zinciri oluşturur
 * @param middlewares - Zincirlenecek middleware'ler
 * @returns Express request handler
 */
export function createAuthMiddlewareChain(
  ...middlewares: Array<(req: AuthRequest, res: Response, next: NextFunction) => Promise<void> | void>
): RequestHandler {
  return createMiddlewareChain<AuthRequest>(...middlewares);
}

export default {
  createMiddlewareChain,
  createAuthMiddlewareChain
};
