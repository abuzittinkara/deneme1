/**
 * src/middleware/advancedErrorHandler.ts
 * Gelişmiş hata işleme middleware'i
 */
import { Request, Response, NextFunction, Application } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { trackError, reportToSentry, createRequestContext } from '../utils/errorReporter';
import { AppError } from '../utils/appError';

/**
 * 404 hata işleyici
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`${req.originalUrl} bulunamadı`, 404, 'NOT_FOUND');
  error.isOperational = true;
  next(error);
};

/**
 * Genel hata işleyici
 * @param err - Hata nesnesi
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // Hata nesnesini standartlaştır
  const error = normalizeError(err);
  
  // İstek bağlamını oluştur
  const requestContext = createRequestContext(req);
  
  // Hata metadatasını oluştur
  const errorMetadata = {
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params,
    body: sanitizeRequestBody(req.body),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
    statusCode: error.statusCode,
    errorCode: error.code,
    isOperational: error.isOperational
  };
  
  // Hata seviyesini belirle
  const logLevel = error.statusCode >= 500 ? 'error' : 
                  error.statusCode >= 400 ? 'warn' : 'info';
  
  // Hatayı logla
  logger[logLevel](`${error.name}: ${error.message}`, {
    ...errorMetadata,
    stack: error.stack
  });
  
  // Hatayı izleme sistemine ekle
  trackError(error, req.path, errorMetadata);
  
  // 500 ve üzeri hataları Sentry'ye bildir
  if (error.statusCode >= 500 || !error.isOperational) {
    reportToSentry(error, {
      ...requestContext,
      ...errorMetadata
    });
  }
  
  // Hata yanıtını oluştur
  const errorResponse = createErrorResponse(error, req);
  
  // Hata yanıtını gönder
  res.status(error.statusCode).json(errorResponse);
};

/**
 * Hata nesnesini standartlaştır
 * @param err - Hata nesnesi
 * @returns Standartlaştırılmış hata nesnesi
 */
function normalizeError(err: any): AppError {
  // Zaten AppError ise doğrudan döndür
  if (err instanceof AppError) {
    return err;
  }
  
  // Hata türüne göre standartlaştır
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Sunucu hatası';
  let code = err.code || 'SERVER_ERROR';
  let isOperational = err.isOperational || false;
  
  // Mongoose doğrulama hatası
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Doğrulama hatası';
    code = 'VALIDATION_ERROR';
    isOperational = true;
  }
  
  // Mongoose çoğaltma hatası
  if (err.name === 'MongoError' && err.code === 11000) {
    statusCode = 409;
    message = 'Çoğaltma hatası';
    code = 'DUPLICATE_ERROR';
    isOperational = true;
  }
  
  // JWT hatası
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Geçersiz token';
    code = 'INVALID_TOKEN';
    isOperational = true;
  }
  
  // JWT süresi dolmuş
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token süresi doldu';
    code = 'TOKEN_EXPIRED';
    isOperational = true;
  }
  
  // SyntaxError
  if (err.name === 'SyntaxError') {
    statusCode = 400;
    message = 'Sözdizimi hatası';
    code = 'SYNTAX_ERROR';
    isOperational = true;
  }
  
  // Yeni AppError oluştur
  const normalizedError = new AppError(message, statusCode, code);
  normalizedError.stack = err.stack;
  normalizedError.isOperational = isOperational;
  
  return normalizedError;
}

/**
 * İstek gövdesini temizle (hassas bilgileri kaldır)
 * @param body - İstek gövdesi
 * @returns Temizlenmiş istek gövdesi
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return {};
  
  // Derin kopya oluştur
  const sanitized = JSON.parse(JSON.stringify(body));
  
  // Hassas alanları kaldır
  const sensitiveFields = ['password', 'passwordConfirm', 'token', 'refreshToken', 'secret', 'apiKey', 'credit_card'];
  
  // Nesneyi dolaş ve hassas alanları kaldır
  function sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    });
    
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Hata yanıtını oluştur
 * @param error - Hata nesnesi
 * @param req - Express istek nesnesi
 * @returns Hata yanıtı
 */
function createErrorResponse(error: AppError, req: Request): any {
  const response: any = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    }
  };
  
  // Geliştirme ortamında daha fazla bilgi ekle
  if (env.isDevelopment) {
    response.error.stack = error.stack;
    response.error.path = req.path;
    response.error.method = req.method;
  }
  
  // Doğrulama hatası ise detayları ekle
  if (error.code === 'VALIDATION_ERROR' && error.details) {
    response.error.details = error.details;
  }
  
  return response;
}

/**
 * Yakalanmamış hataları işle
 */
export const setupUncaughtExceptionHandlers = (): void => {
  // Yakalanmamış istisnaları işle
  process.on('uncaughtException', (error) => {
    logger.error('Yakalanmamış istisna', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Kritik hatalardan sonra uygulamayı güvenli bir şekilde kapat
    if (env.isProduction) {
      logger.error('Kritik hata nedeniyle uygulama kapatılıyor');
      
      // Temizlik işlemleri için biraz bekle
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
  
  // İşlenmeyen reddetmeleri işle
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('İşlenmeyen reddetme', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString()
    });
  });
};

/**
 * Hata işleme middleware'lerini yapılandır
 * @param app - Express uygulaması
 */
export const setupErrorHandlers = (app: Application): void => {
  // 404 hatası için middleware
  app.use(notFoundHandler);
  
  // Genel hata işleyici middleware
  app.use(errorHandler);
  
  // Yakalanmamış hata işleyicileri
  setupUncaughtExceptionHandlers();
  
  logger.info('Hata işleme middleware\'leri yapılandırıldı');
};

export default {
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandlers,
  setupErrorHandlers
};
