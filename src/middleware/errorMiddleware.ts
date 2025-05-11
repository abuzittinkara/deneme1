/**
 * src/middleware/errorMiddleware.ts
 * Hata yönetimi middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * 404 Not Found hatası middleware'i
 *
 * @param req - Express request nesnesi
 * @param res - Express response nesnesi
 * @param next - Express next fonksiyonu
 */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`${req.originalUrl} - Bulunamadı`);
  res.status(404);
  next(error);
};

/**
 * Genel hata yönetimi middleware'i
 *
 * @param err - Hata nesnesi
 * @param req - Express request nesnesi
 * @param res - Express response nesnesi
 * @param next - Express next fonksiyonu
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // Hata durumunu belirle
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Hata mesajını belirle
  let message = err.message || 'Sunucu hatası';

  // Hata tipini belirle
  let errorType = 'ServerError';

  // Özel hata sınıfları için durum kodu ve tip belirleme
  if (err instanceof AppError) {
    res.status(err.statusCode);
    errorType = err.name;
  } else {
    res.status(statusCode);
  }

  // MongoDB CastError (geçersiz ID) için özel mesaj
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Geçersiz ID formatı';
    errorType = 'ValidationError';
    res.status(400);
  }

  // MongoDB ValidationError için özel mesaj
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(', ');
    errorType = 'ValidationError';
    res.status(400);
  }

  // MongoDB Duplicate Key Error için özel mesaj
  if (err.code === 11000) {
    message = `${Object.keys(err.keyValue).join(', ')} zaten kullanılıyor`;
    errorType = 'ConflictError';
    res.status(409);
  }

  // JWT hataları için özel mesaj
  if (err.name === 'JsonWebTokenError') {
    message = 'Geçersiz token';
    errorType = 'AuthenticationError';
    res.status(401);
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Token süresi doldu';
    errorType = 'AuthenticationError';
    res.status(401);
  }

  // Hatayı logla
  const logLevel = res.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel](`${errorType}: ${message}`, {
    error: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    statusCode: res.statusCode,
  });

  // Hata yanıtını gönder
  res.json({
    success: false,
    error: {
      message,
      type: errorType,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
};

export default {
  notFound,
  errorHandler,
};
