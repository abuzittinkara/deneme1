/**
 * src/middleware/errorHandler.ts
 * Express hata işleyici middleware
 */
import { Request, Response, NextFunction } from 'express';
import { logger, logError } from '../utils/logger';
import { trackError } from '../utils/errorTracker';
import { sentryReportError } from './sentryHandler';
import { env } from '../config/env';
import errorManager, { AppError as BaseAppError, ErrorCode } from '../utils/errorManager';

// AppError sınıfını dışa aktar
export class AppError extends BaseAppError {}

// İstek gövdesini sanitize et
function sanitizeRequestBody(body: any): any {
  if (!body) return {};

  // Hassas alanları maskele
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'key', 'credential'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***MASKED***';
    }
  }

  return sanitized;
}

/**
 * 404 hatası için middleware
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(`${req.originalUrl} bulunamadı`, 404, ErrorCode.NOT_FOUND);
  next(err);
};

/**
 * Hata yanıtı oluşturma fonksiyonu
 */
export const createErrorResponse = (err: any, req: Request) => {
  // Merkezi hata yönetim sistemini kullan
  return errorManager.createErrorResponse(err, req);
};

/**
 * Hata işleyici middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Merkezi hata yönetim sistemini kullan
  return errorManager.errorHandler(err, req, res, _next);
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
  startTime: new Date(),
};

/**
 * Hata metriklerini güncelle
 */
export function trackErrorMetric(err: any, path?: string): void {
  const code = err.code || 'UNKNOWN';

  // Hata sayısını artır
  errorMetrics.counts[code] = (errorMetrics.counts[code] || 0) + 1;

  // Son hataları güncelle
  errorMetrics.lastErrors.unshift({
    code,
    message: err.message,
    timestamp: new Date(),
    path,
  });

  // Son 100 hatayı tut
  if (errorMetrics.lastErrors.length > 100) {
    errorMetrics.lastErrors.pop();
  }
}

/**
 * Hata metriklerini getir
 */
export function getErrorMetrics() {
  return {
    ...errorMetrics,
    uptime: Date.now() - errorMetrics.startTime.getTime(),
  };
}

/**
 * Yakalanmamış hata işleyicilerini kur
 */
export function setupUncaughtExceptionHandlers(): void {
  // İşlenmeyen istisnaları işle
  process.on('uncaughtException', (error) => {
    logger.error('İşlenmeyen istisna', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Sentry'ye bildir
    sentryReportError(error, { context: 'Uncaught Exception' });

    // Uygulamayı güvenli bir şekilde kapat
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // İşlenmeyen reddetmeleri işle
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('İşlenmeyen reddetme', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Sentry'ye bildir
    if (reason instanceof Error) {
      sentryReportError(reason, { context: 'Unhandled Rejection' });
    }
  });

  logger.info('Yakalanmamış hata işleyicileri kuruldu');
}

export default {
  AppError,
  errorHandler,
  notFoundHandler,
  createErrorResponse,
  getErrorMetrics,
  setupUncaughtExceptionHandlers,
};
