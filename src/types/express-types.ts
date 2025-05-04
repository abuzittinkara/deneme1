/**
 * src/types/express-types.ts
 * Express için tip yardımcıları
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express middleware için tip yardımcısı
 */
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | Response;

/**
 * Express route handler için tip yardımcısı
 */
export type ExpressRouteHandler = (req: Request, res: Response) => void | Promise<void> | Response;

/**
 * Express error handler için tip yardımcısı
 */
export type ExpressErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void | Promise<void> | Response;

/**
 * Express middleware oluşturucu
 * @param middleware - Middleware fonksiyonu
 * @returns RequestHandler olarak middleware
 */
export function createMiddleware(middleware: ExpressMiddleware): RequestHandler {
  return middleware as RequestHandler;
}

/**
 * Express route handler oluşturucu
 * @param handler - Route handler fonksiyonu
 * @returns RequestHandler olarak route handler
 */
export function createRouteHandler(handler: ExpressRouteHandler): RequestHandler {
  return handler as RequestHandler;
}

/**
 * Express error handler oluşturucu
 * @param errorHandler - Error handler fonksiyonu
 * @returns RequestHandler olarak error handler
 */
export function createErrorHandler(errorHandler: ExpressErrorHandler): RequestHandler {
  return errorHandler as unknown as RequestHandler;
}

/**
 * Kimlik doğrulama ile genişletilmiş Express Request
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    status?: string;
    sub: string;
    iat?: number;
    exp?: number;
    [key: string]: any;
  };
}

/**
 * Kimlik doğrulama gerektiren route handler için tip yardımcısı
 */
export type AuthRouteHandler = (req: AuthRequest, res: Response) => void | Promise<void> | Response;

/**
 * Kimlik doğrulama gerektiren route handler oluşturucu
 * @param handler - Auth route handler fonksiyonu
 * @returns RequestHandler olarak auth route handler
 */
export function createAuthRouteHandler(handler: AuthRouteHandler): RequestHandler {
  return handler as RequestHandler;
}
