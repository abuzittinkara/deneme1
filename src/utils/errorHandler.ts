/**
 * src/utils/errorHandler.ts
 * Hata işleme yardımcı fonksiyonları
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import sentryHandler from '../middleware/sentryHandler';

// HTTP hata sınıfları
export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

export class ValidationError extends BadRequestError {
  errors?: Record<string, string>;

  constructor(message = 'Validation Error', errors?: Record<string, string>) {
    super(message);
    this.errors = errors;
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(message, 500);
  }
}

// 404 hata işleyici
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`${req.method} ${req.originalUrl} bulunamadı`);
  next(error);
};

// Genel hata işleyici
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Hata türünü belirle
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Bir hata oluştu';

  // Hata detaylarını logla
  if (statusCode >= 500) {
    logger.error('Sunucu hatası', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      statusCode,
    });
  } else {
    logger.warn('İstemci hatası', {
      error: err.message,
      path: req.path,
      method: req.method,
      statusCode,
    });
  }

  // Hata yanıtını oluştur
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode,
    },
  };

  // Validasyon hatası ise hata detaylarını ekle
  if (err instanceof ValidationError && err.errors) {
    errorResponse.error.details = err.errors;
  }

  // Geliştirme modunda stack trace ekle
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Yanıtı gönder
  res.status(statusCode).json(errorResponse);
};

// Yakalanmamış hata işleyicileri
export const setupUncaughtExceptionHandlers = () => {
  // Yakalanmamış istisnalar
  process.on('uncaughtException', (error) => {
    logger.error('Yakalanmamış istisna', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Sentry'ye bildir
    sentryHandler.sentryReportError(error, { context: 'Uncaught Exception' });

    // Kritik hata ise uygulamayı sonlandır
    if (isCriticalError(error)) {
      logger.error('Kritik hata nedeniyle uygulama sonlandırılıyor');
      console.error('UNCAUGHT EXCEPTION! Shutting down...');
      process.exit(1);
    }
  });

  // Yakalanmamış promise redleri
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    logger.error('Yakalanmamış Promise reddi', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Sentry'ye bildir
    sentryHandler.sentryReportError(error, { context: 'Unhandled Rejection' });

    // Kritik hata ise uygulamayı sonlandır
    if (isCriticalError(error)) {
      logger.error('Kritik hata nedeniyle uygulama sonlandırılıyor');
      console.error('UNHANDLED REJECTION! Shutting down...');
      process.exit(1);
    }
  });

  // SIGTERM sinyali
  process.on('SIGTERM', () => {
    logger.info('SIGTERM sinyali alındı. Graceful shutdown başlatılıyor...');
    // Graceful shutdown app.ts içinde yapılıyor
  });
};

// Kritik hata olup olmadığını kontrol et
function isCriticalError(error: Error): boolean {
  const errorMessage = error.message || '';
  const errorStack = error.stack || '';

  // Kritik hata mesajlarını kontrol et
  const criticalErrors = [
    'EACCES', // Yetki hatası
    'EADDRINUSE', // Port zaten kullanımda
    'ECONNREFUSED', // Bağlantı reddedildi
    'ETIMEDOUT', // Bağlantı zaman aşımı
    'ENOTFOUND', // Host bulunamadı
    'EPIPE', // Kırık pipe
    'ERR_SOCKET_CLOSED', // Socket kapatıldı
    'out of memory', // Bellek yetersiz
    'heap out of memory', // Heap bellek yetersiz
    'Cannot read property', // Null/undefined nesne erişimi
    'is not a function', // Fonksiyon olmayan bir değeri çağırma
    'is not defined', // Tanımlanmamış değişken
    'Maximum call stack size exceeded', // Stack overflow
  ];

  // Kritik hata mesajlarını kontrol et
  for (const criticalError of criticalErrors) {
    if (errorMessage.includes(criticalError) || errorStack.includes(criticalError)) {
      return true;
    }
  }

  return false;
}

export default {
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandlers,
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  InternalServerError,
};
