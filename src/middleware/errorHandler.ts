/**
 * src/middleware/errorHandler.ts
 * Express hata işleyici middleware
 */
import { Request, Response, NextFunction } from 'express';
import { logger, logError } from '../utils/logger';
import { trackError } from '../utils/errorTracker';
import { sentryReportError } from './sentryHandler';
import { env } from '../config/env';

// Özel hata sınıfı
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// İstek gövdesini sanitize et
function sanitizeRequestBody(body: any): any {
  if (!body) return {};

  // Derin kopya oluştur
  const sanitized = JSON.parse(JSON.stringify(body));

  // Hassas alanları maskele
  const sensitiveFields = ['password', 'passwordConfirm', 'currentPassword', 'newPassword',
                          'token', 'refreshToken', 'secret', 'apiKey', 'key', 'pin',
                          'creditCard', 'cardNumber', 'cvv', 'ssn', 'socialSecurityNumber'];

  // Nesneyi dolaş ve hassas alanları maskele
  function traverse(obj: any) {
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) continue;

      // Hassas alan kontrolü
      if (sensitiveFields.includes(key.toLowerCase()) || key.toLowerCase().includes('password')) {
        obj[key] = '******';
      }
      // Alt nesneleri dolaş
      else if (typeof obj[key] === 'object') {
        traverse(obj[key]);
      }
    }
  }

  traverse(sanitized);
  return sanitized;
}

// Hata yanıtı oluşturma fonksiyonu
const createErrorResponse = (err: any, req: Request) => {
  // Varsayılan hata yanıtı
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Bir hata oluştu',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      statusCode: err.statusCode || 500,
      requestId: req.headers['x-request-id'] || '',
      timestamp: new Date().toISOString()
    }
  };

  // Validasyon hatası ise detayları ekle
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // Geliştirme ortamında hata detaylarını ekle
  if (env.isDevelopment) {
    return {
      ...errorResponse,
      error: {
        ...errorResponse.error,
        stack: err.stack,
        name: err.name,
        isOperational: err.isOperational,
        originalMessage: err.originalMessage,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body ? sanitizeRequestBody(req.body) : null,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'accept': req.headers['accept'],
          'x-request-id': req.headers['x-request-id']
        }
      }
    };
  }

  return errorResponse;
};

// Hata işleyici middleware
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Hata durumunu belirle
  err.statusCode = err.statusCode || 500;
  err.originalMessage = err.message; // Orijinal mesajı sakla
  err.code = err.code || 'INTERNAL_SERVER_ERROR';

  // Hata tipine göre işlem yap
  if (err.name === 'ValidationError') {
    // Mongoose veya express-validator doğrulama hatası
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';

    // Express-validator hatalarını daha anlaşılır hale getir
    if (err.errors && Array.isArray(err.errors)) {
      err.details = err.errors.map((e: any) => ({
        field: e.param,
        message: e.msg,
        value: e.value
      }));
      err.message = err.errors.map((e: any) => `${e.param}: ${e.msg}`).join(', ');
    }
    // Mongoose doğrulama hatalarını işle
    else if (err.errors && typeof err.errors === 'object') {
      const errorDetails: any[] = [];
      Object.keys(err.errors).forEach(key => {
        const error = err.errors[key];
        errorDetails.push({
          field: key,
          message: error.message,
          value: error.value
        });
      });

      err.details = errorDetails;
      err.message = errorDetails.map(e => `${e.field}: ${e.message}`).join(', ');
    }
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    // MongoDB benzersizlik hatası (MongoDB 5.x+ için MongoServerError)
    err.statusCode = 409;
    err.code = 'DUPLICATE_ERROR';

    // Hangi alanın çakıştığını belirle
    const field = Object.keys(err.keyValue || {})[0];
    err.message = field
      ? `${field} değeri zaten kullanılıyor`
      : 'Bu kayıt zaten mevcut';
  } else if (err.name === 'JsonWebTokenError') {
    // JWT hatası
    err.statusCode = 401;
    err.code = 'INVALID_TOKEN';
    err.message = 'Geçersiz token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT süresi dolmuş
    err.statusCode = 401;
    err.code = 'TOKEN_EXPIRED';
    err.message = 'Token süresi doldu';
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    // MongoDB ObjectId hatası
    err.statusCode = 400;
    err.code = 'INVALID_ID';
    err.message = `Geçersiz ID formatı: ${err.value}`;
  } else if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    // JSON ayrıştırma hatası
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    err.message = 'Geçersiz JSON formatı';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    // Bağlantı hatası
    err.statusCode = 503;
    err.code = 'SERVICE_UNAVAILABLE';
    err.message = 'Servis şu anda kullanılamıyor';
  } else if (err.name === 'MulterError') {
    // Dosya yükleme hatası
    err.statusCode = 400;
    err.code = 'FILE_UPLOAD_ERROR';

    // Multer hata tipine göre mesajı özelleştir
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        err.message = 'Dosya boyutu çok büyük';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        err.message = 'Beklenmeyen dosya alanı';
        break;
      case 'LIMIT_FILE_COUNT':
        err.message = 'Çok fazla dosya';
        break;
      default:
        err.message = 'Dosya yükleme hatası: ' + err.message;
    }
  } else if (err.name === 'TypeError' || err.name === 'ReferenceError') {
    // Programlama hataları
    err.statusCode = 500;
    err.code = 'SERVER_ERROR';
    err.isOperational = false;

    // Üretim ortamında kullanıcıya genel bir hata mesajı göster
    if (process.env.NODE_ENV === 'production') {
      err.publicMessage = 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
    }
  }

  // Geliştirme modunda daha detaylı hata mesajları
  if (process.env.NODE_ENV === 'development') {
    // Orijinal hata mesajını geliştirme modunda göster
    if (err.originalMessage !== err.message) {
      err.details = err.details || {};
      err.details.originalMessage = err.originalMessage;
    }
  }

  // Hata metriklerini güncelle
  updateErrorMetrics(err);

  // Hata bağlamını oluştur
  const errorContext = {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id || 'anonymous',
    query: req.query,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    accept: req.headers['accept'],
    requestId: req.headers['x-request-id'] || ''
  };

  // Hata meta verilerini oluştur
  const errorMetadata = {
    ...errorContext,
    body: req.body ? JSON.stringify(sanitizeRequestBody(req.body)).substring(0, 1000) : null,
    statusCode: err.statusCode,
    code: err.code,
    isOperational: err.isOperational
  };

  // Operasyonel olmayan hataları logla (programlama hataları)
  if (!err.isOperational) {
    // Detaylı loglama
    logError(err, 'Non-operational error', errorMetadata);

    // Sentry'ye bildir
    sentryReportError(err, {
      context: 'Non-operational error',
      ...errorContext
    });
  } else {
    // Operasyonel hataları da logla ama daha az detayla
    logger.warn(`${err.statusCode} - ${err.message}`, {
      metadata: {
        code: err.code,
        ...errorContext
      }
    });

    // 500 ve üzeri hataları Sentry'ye bildir
    if (err.statusCode >= 500) {
      sentryReportError(err, {
        context: 'Operational error',
        ...errorContext
      });
    }
  }

  // Hata izleme sistemine ekle
  trackError(err, req.path, errorMetadata);

  // Hata yanıtını oluştur
  const errorResponse = createErrorResponse(err, req);

  // Hata yanıtını gönder
  res.status(err.statusCode).json(errorResponse);
};

// Hata metriklerini güncelle
const errorMetrics = {
  counts: {} as Record<string, number>,
  lastErrors: [] as Array<{
    code: string;
    message: string;
    timestamp: Date;
    path?: string;
  }>,
  startTime: new Date()
};

function updateErrorMetrics(err: any): void {
  // Hata koduna göre sayıları güncelle
  const errorCode = err.code || 'UNKNOWN_ERROR';
  errorMetrics.counts[errorCode] = (errorMetrics.counts[errorCode] || 0) + 1;

  // Son hataları kaydet (en fazla 10 tane)
  errorMetrics.lastErrors.unshift({
    code: errorCode,
    message: err.message,
    timestamp: new Date(),
    path: err.path
  });

  // Listeyi 10 öğeyle sınırla
  if (errorMetrics.lastErrors.length > 10) {
    errorMetrics.lastErrors.pop();
  }
}

// Hata metriklerini getir
export function getErrorMetrics(): typeof errorMetrics {
  return errorMetrics;
}

// Yakalanmamış hataları işle
export const setupUncaughtExceptionHandlers = () => {
  // Yakalanmamış istisnaları işle
  process.on('uncaughtException', (error) => {
    // Hata detaylarını logla
    const errorInfo = logError(error, 'Uncaught Exception');

    // Hata izleme sistemine ekle
    trackError(error, 'Uncaught Exception', {
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    // Sentry'ye bildir
    sentryReportError(error, {
      context: 'Uncaught Exception',
      processId: process.pid,
      memoryUsage: JSON.stringify(process.memoryUsage()),
      uptime: process.uptime()
    });

    // Geliştirme modunda daha detaylı konsol çıktısı
    if (env.isDevelopment) {
      console.error('\n\n==== UNCAUGHT EXCEPTION! ====');
      console.error(`Hata: ${error.message}`);
      console.error(`Tip: ${error.name}`);
      console.error(`Stack: \n${error.stack}`);
      console.error('===============================\n');
    } else {
      console.error('UNCAUGHT EXCEPTION! Shutting down...');
    }

    // Uygulamayı güvenli bir şekilde kapat (kısa bir gecikme ile)
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Yakalanmamış promise redlerini işle
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    // Hata detaylarını logla
    const errorInfo = logError(error, 'Unhandled Rejection');

    // Hata izleme sistemine ekle
    trackError(error, 'Unhandled Rejection', {
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    // Sentry'ye bildir
    sentryReportError(error, {
      context: 'Unhandled Rejection',
      processId: process.pid,
      memoryUsage: JSON.stringify(process.memoryUsage()),
      uptime: process.uptime()
    });

    // Geliştirme modunda daha detaylı konsol çıktısı
    if (env.isDevelopment) {
      console.error('\n\n==== UNHANDLED REJECTION! ====');
      console.error(`Hata: ${error.message}`);
      console.error(`Tip: ${error.name}`);
      console.error(`Stack: \n${error.stack}`);
      console.error('=================================\n');
    } else {
      console.error('UNHANDLED REJECTION! Shutting down...');
    }

    // Uygulamayı güvenli bir şekilde kapat (kısa bir gecikme ile)
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // SIGTERM sinyalini işle
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    process.exit(0);
  });

  // Geliştirme modunda ek hata yakalama
  if (process.env.NODE_ENV === 'development') {
    // Bellek sızıntılarını izle
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 1024 * 1024 * 500) { // 500MB'dan fazla kullanım
        logger.warn('Yüksek bellek kullanımı tespit edildi', {
          metadata: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`
          }
        });
      }
    }, 60000); // Her dakika kontrol et
  }
};

// 404 hatası için middleware
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(`${req.originalUrl} bulunamadı`, 404, 'NOT_FOUND');
  next(err);
};

export default errorHandler;
