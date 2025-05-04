/**
 * src/types/express-extended.d.ts
 * Express için genişletilmiş tip tanımlamaları
 */
import { Request, Response, NextFunction } from 'express';
import { UserDocument } from '../models/User';

// Express için genişletilmiş tip tanımlamaları
declare global {
  namespace Express {
    // Express.Request için genişletilmiş tip tanımlaması
    interface Request {
      user?: {
        id: string;
        username: string;
        sub: string;
        role: string;
      };
      startTime?: number;
      requestId?: string;
      originalUrl?: string;
      ip?: string;
      method?: string;
      route?: {
        path: string;
      };
    }
  }
}

// AuthRequest tipi
export interface AuthRequest extends Request {
  user: {
    id: string;
    username: string;
    sub: string;
    role: string;
  };
}

// Express middleware fonksiyon tipi
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

// Express handler fonksiyon tipi
export type ExpressHandler = (req: Request, res: Response) => void | Promise<void>;

// Express auth handler fonksiyon tipi
export type ExpressAuthHandler = (req: AuthRequest, res: Response) => void | Promise<void>;

// Express middleware oluşturucu
export function createMiddlewareHelper<T extends Request>(handler: (req: T, res: Response, next: NextFunction) => void | Promise<void>): ExpressMiddleware {
  return (req: Request, res: Response, next: NextFunction) => {
    return handler(req as T, res, next);
  };
}

// Express auth middleware oluşturucu
export function createAuthMiddleware(handler: (req: AuthRequest, res: Response, next: NextFunction) => void | Promise<void>): ExpressMiddleware {
  return (req: Request, res: Response, next: NextFunction) => {
    return handler(req as AuthRequest, res, next);
  };
}

// Express route handler oluşturucu
export function createRouteHandler<T extends Request>(handler: (req: T, res: Response) => void | Promise<void>): ExpressHandler {
  return (req: Request, res: Response) => {
    return handler(req as T, res);
  };
}

// Express auth route handler oluşturucu
export function createAuthRouteHandler(handler: (req: AuthRequest, res: Response) => void | Promise<void>): ExpressHandler {
  return (req: Request, res: Response) => {
    return handler(req as AuthRequest, res);
  };
}
