/**
 * src/utils/errorManager.ts
 * Merkezi hata yönetim sistemi
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import * as Sentry from '@sentry/node';
import { env } from '../config/env';

/**
 * Hata kodları
 */
export enum ErrorCode {
  // Genel hatalar
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Kimlik doğrulama ve yetkilendirme hataları
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',

  // Veritabanı hataları
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  INVALID_ID = 'INVALID_ID',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Kullanıcı hataları
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',

  // Dış servis hataları
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Dosya hataları
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // Özel uygulama hataları
  INVALID_REQUEST = 'INVALID_REQUEST',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}

/**
 * Temel hata sınıfı
 */
export class AppError extends Error {
  statusCode: number;
  code: ErrorCode | string;
  isOperational: boolean;
  details?: any;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
    isOperational = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Doğrulama hatası
 */
export class ValidationError extends AppError {
  constructor(message = 'Doğrulama hatası', details?: any) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }
}

/**
 * Kimlik doğrulama hatası
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Kimlik doğrulama hatası', details?: any) {
    super(message, 401, ErrorCode.UNAUTHORIZED, true, details);
  }
}

/**
 * Yetkilendirme hatası
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Yetkilendirme hatası', details?: any) {
    super(message, 403, ErrorCode.FORBIDDEN, true, details);
  }
}

/**
 * Bulunamadı hatası
 */
export class NotFoundError extends AppError {
  constructor(message = 'Kaynak bulunamadı', details?: any) {
    super(message, 404, ErrorCode.NOT_FOUND, true, details);
  }
}

/**
 * Çakışma hatası
 */
export class ConflictError extends AppError {
  constructor(message = 'Kaynak zaten mevcut', details?: any) {
    super(message, 409, ErrorCode.RESOURCE_EXISTS, true, details);
  }
}

/**
 * Veritabanı hatası
 */
export class DatabaseError extends AppError {
  constructor(message = 'Veritabanı hatası', details?: any) {
    super(message, 500, ErrorCode.DATABASE_ERROR, true, details);
  }
}

/**
 * Dış servis hatası
 */
export class ExternalServiceError extends AppError {
  constructor(message = 'Dış servis hatası', details?: any) {
    super(message, 502, ErrorCode.EXTERNAL_SERVICE_ERROR, true, details);
  }
}

/**
 * Sunucu hatası
 */
export class ServerError extends AppError {
  constructor(message = 'Sunucu hatası', details?: any) {
    super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, details);
  }
}

/**
 * Hata yanıtı oluşturma
 */
export function createErrorResponse(err: any, req: Request): any {
  // Varsayılan hata yanıtı
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Bir hata oluştu',
      code: err.code || ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: err.statusCode || 500,
    },
    requestId: req.headers['x-request-id'] || '',
    timestamp: new Date().toISOString(),
  };

  // Geliştirme ortamında hata detaylarını ekle
  if (env.isDevelopment) {
    return {
      ...errorResponse,
      error: {
        ...errorResponse.error,
        stack: err.stack,
        details: err.details || null,
      },
    };
  }

  return errorResponse;
}

/**
 * Hata işleme middleware'i
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  // Hata durumunu normalize et
  err.statusCode = err.statusCode || 500;
  err.code = err.code || ErrorCode.INTERNAL_SERVER_ERROR;

  // Hata tipine göre işlem yap
  normalizeError(err);

  // Hata bağlamını oluştur
  const errorContext = {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id || 'anonymous',
  };

  // Operasyonel olmayan hataları logla ve Sentry'ye bildir
  if (!err.isOperational) {
    logger.error(`[${err.code}] ${err.message}`, {
      ...errorContext,
      stack: err.stack,
      details: err.details,
    });

    // Sentry'ye bildir
    Sentry.captureException(err, {
      tags: {
        code: err.code,
        path: req.path,
        method: req.method,
      },
      user: {
        id: (req as any).user?.id || 'anonymous',
      },
      extra: errorContext,
    });
  } else {
    // Operasyonel hataları logla
    const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
    logger[logLevel](`[${err.code}] ${err.message}`, errorContext);

    // 500 ve üzeri hataları Sentry'ye bildir
    if (err.statusCode >= 500) {
      Sentry.captureException(err);
    }
  }

  // Hata yanıtını oluştur ve gönder
  const errorResponse = createErrorResponse(err, req);
  res.status(err.statusCode).json(errorResponse);
}

/**
 * Hata tipini normalize et
 */
function normalizeError(err: any): void {
  // Mongoose doğrulama hatası
  if (err.name === 'ValidationError') {
    err.statusCode = 400;
    err.code = ErrorCode.VALIDATION_ERROR;
  }
  // MongoDB benzersizlik hatası
  else if (err.name === 'MongoError' && err.code === 11000) {
    err.statusCode = 409;
    err.code = ErrorCode.DUPLICATE_KEY;
    err.message = 'Bu kayıt zaten mevcut';
  }
  // JWT hatası
  else if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.code = ErrorCode.INVALID_TOKEN;
    err.message = 'Geçersiz token';
  }
  // JWT süresi dolmuş
  else if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.code = ErrorCode.TOKEN_EXPIRED;
    err.message = 'Token süresi doldu';
  }
  // MongoDB ObjectId hatası
  else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    err.statusCode = 400;
    err.code = ErrorCode.INVALID_ID;
    err.message = `Geçersiz ID formatı: ${err.value}`;
  }
  // JSON ayrıştırma hatası
  else if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    err.statusCode = 400;
    err.code = ErrorCode.BAD_REQUEST;
    err.message = 'Geçersiz JSON formatı';
  }
}

/**
 * Hata fabrikası
 * Hata türüne göre uygun hata nesnesi oluşturur
 */
export const createError = (type: string, message?: string, details?: any): AppError => {
  switch (type.toLowerCase()) {
    case 'validation':
      return new ValidationError(message || 'Doğrulama hatası', details);
    case 'authentication':
      return new AuthenticationError(message || 'Kimlik doğrulama hatası', details);
    case 'authorization':
      return new AuthorizationError(message || 'Bu işlem için yetkiniz yok', details);
    case 'notfound':
      return new NotFoundError(message || 'Kaynak bulunamadı', details);
    case 'duplicate':
    case 'conflict':
      return new ConflictError(message || 'Kayıt zaten mevcut', details);
    case 'timeout':
      return new AppError(
      message || 'İşlem zaman aşımına uğradı',
      408,
      ErrorCode.TOO_MANY_REQUESTS,
      true,
      details
    );
    case 'database':
      return new DatabaseError(message || 'Veritabanı hatası', details);
    case 'server':
      return new ServerError(message || 'Sunucu hatası', details);
    case 'externalservice':
      return new ExternalServiceError(message || 'Dış servis hatası', details);
    case 'badrequest':
      return new AppError(message || 'Geçersiz istek', 400, ErrorCode.BAD_REQUEST, true, details);
    default:
      return new AppError(
      message || 'Uygulama hatası',
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      true,
      details
    );
  }
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  ServerError,
  ErrorCode,
  errorHandler,
  createErrorResponse,
  createError,
};
