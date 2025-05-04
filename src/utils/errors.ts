/**
 * src/utils/errors.ts
 * Hata işleme yardımcı fonksiyonları
 */
import { Request, Response, NextFunction } from 'express';
import { logger, logError } from './logger';
import * as sentryHandler from '../middleware/sentryHandler';
import { createMiddlewareHelper } from './express-helpers';

/**
 * Hata kodları
 */
export enum ErrorCodes {
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  INVALID_ID = 'INVALID_ID',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  INVALID_OPERATION = 'INVALID_OPERATION',
  OPERATION_FAILED = 'OPERATION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFLICT = 'CONFLICT',
  FRIENDSHIP_ERROR = 'FRIENDSHIP_ERROR',
  SERVER_ERROR = 'SERVER_ERROR'
}

/**
 * Özel hata sınıfı
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, isOperational = true, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async fonksiyonları try-catch ile sarmak için yardımcı fonksiyon
 * @param fn - Async fonksiyon
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Hata yanıtı oluşturma fonksiyonu
 * @param err - Hata nesnesi
 * @param req - Express request nesnesi
 */
export const createErrorResponse = (err: any, req: Request) => {
  // Varsayılan hata yanıtı
  const errorResponse = {
    success: false,
    message: err.message || 'Bir hata oluştu',
    code: err.code || ErrorCodes.INTERNAL_SERVER_ERROR,
    requestId: req.headers['x-request-id'] || '',
    timestamp: new Date().toISOString(),
  };

  // Geliştirme ortamında hata detaylarını ekle
  if (process.env.NODE_ENV === 'development') {
    return {
      ...errorResponse,
      stack: err.stack,
      details: err.details || null,
    };
  }

  return errorResponse;
};

/**
 * Hata işleyici middleware
 */
const _errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Hata durumunu belirle
  err.statusCode = err.statusCode || 500;

  // Hata tipine göre işlem yap
  if (err.name === 'ValidationError') {
    // Mongoose veya express-validator doğrulama hatası
    err.statusCode = 400;
    err.code = ErrorCodes.VALIDATION_ERROR;
  } else if (err.name === 'MongoError' && err.code === 11000) {
    // MongoDB benzersizlik hatası
    err.statusCode = 409;
    err.code = ErrorCodes.DUPLICATE_KEY;
    err.message = 'Bu kayıt zaten mevcut';
  } else if (err.name === 'JsonWebTokenError') {
    // JWT hatası
    err.statusCode = 401;
    err.code = ErrorCodes.INVALID_TOKEN;
    err.message = 'Geçersiz token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT süresi dolmuş
    err.statusCode = 401;
    err.code = ErrorCodes.TOKEN_EXPIRED;
    err.message = 'Token süresi doldu';
  }

  // Operasyonel olmayan hataları logla (programlama hataları)
  if (!err.isOperational) {
    logError(err, 'Non-operational error', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      // @ts-ignore - Tip hatasını görmezden gel
      userId: req.user?.id || 'anonymous',
    });

    // Sentry'ye bildir
    sentryHandler.sentryReportError(err, {
      context: 'Non-operational error',
      path: req.path,
      method: req.method,
      // @ts-ignore - Tip hatasını görmezden gel
      userId: req.user?.id || 'anonymous',
    });
  }

  // Hata yanıtını oluştur
  const errorResponse = createErrorResponse(err, req);

  // Hata yanıtını gönder
  res.status(err.statusCode).json(errorResponse);
};

// Tip güvenli middleware
// @ts-ignore - Tip hatasını görmezden gel
export const errorHandler = createMiddlewareHelper(_errorHandler);

/**
 * 404 hatası için middleware
 */
const _notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(`${req.originalUrl} bulunamadı`, 404, ErrorCodes.NOT_FOUND);
  next(err);
};

// Tip güvenli middleware
export const notFoundHandler = createMiddlewareHelper(_notFoundHandler);

/**
 * Hata fırlatma yardımcı fonksiyonu
 * @param message - Hata mesajı
 * @param statusCode - HTTP durum kodu
 * @param code - Hata kodu
 * @param details - Ek hata detayları
 */
export const throwError = (message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details?: any) => {
  throw new AppError(message, statusCode, code, true, details);
};

/**
 * Koşul kontrolü ile hata fırlatma
 * @param condition - Kontrol edilecek koşul
 * @param message - Hata mesajı
 * @param statusCode - HTTP durum kodu
 * @param code - Hata kodu
 * @param details - Ek hata detayları
 */
export const throwIf = (condition: boolean, message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details?: any) => {
  if (condition) {
    throwError(message, statusCode, code, details);
  }
};

/**
 * Koşul kontrolü ile hata fırlatma (ters)
 * @param condition - Kontrol edilecek koşul
 * @param message - Hata mesajı
 * @param statusCode - HTTP durum kodu
 * @param code - Hata kodu
 * @param details - Ek hata detayları
 */
export const throwUnless = (condition: boolean, message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details?: any) => {
  if (!condition) {
    throwError(message, statusCode, code, details);
  }
};

/**
 * Bulunamadı hatası
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Bulunamadı', details?: any) {
    super(message, 404, ErrorCodes.NOT_FOUND, true, details);
  }
}

/**
 * Doğrulama hatası
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Doğrulama hatası', details?: any) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR, true, details);
  }
}

/**
 * Yetkilendirme hatası
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Kimlik doğrulama başarısız', details?: any) {
    super(message, 401, ErrorCodes.UNAUTHORIZED, true, details);
  }
}

/**
 * Yetkisiz erişim hatası
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Yetkisiz erişim', details?: any) {
    super(message, 401, ErrorCodes.UNAUTHORIZED, true, details);
  }
}

/**
 * Yetki hatası
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Bu işlemi gerçekleştirmek için yetkiniz yok', details?: any) {
    super(message, 403, ErrorCodes.FORBIDDEN, true, details);
  }
}

/**
 * Çakışma hatası
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Bu kayıt zaten mevcut', details?: any) {
    super(message, 409, ErrorCodes.CONFLICT, true, details);
  }
}

/**
 * Arkadaşlık hatası
 */
export class FriendshipError extends AppError {
  constructor(message: string = 'Arkadaşlık işlemi hatası', details?: any) {
    super(message, 400, ErrorCodes.FRIENDSHIP_ERROR, true, details);
  }
}

/**
 * Sunucu hatası
 */
export class ServerError extends AppError {
  constructor(message: string = 'Sunucu hatası', details?: any) {
    super(message, 500, ErrorCodes.SERVER_ERROR, true, details);
  }
}

export default {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  FriendshipError,
  ServerError,
  asyncHandler,
  createErrorResponse,
  errorHandler,
  notFoundHandler,
  throwError,
  throwIf,
  throwUnless
};
