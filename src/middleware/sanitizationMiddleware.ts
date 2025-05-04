/**
 * src/middleware/sanitizationMiddleware.ts
 * Kullanıcı girdilerini sanitize eden middleware
 */
import { Request, Response, NextFunction } from 'express';
import { sanitizeAll, sanitizeXss, sanitizeUrl } from '../utils/sanitizer';
import { logger } from '../utils/logger';

/**
 * Tüm request body alanlarını sanitize eder
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

/**
 * Tüm request query parametrelerini sanitize eder
 */
export function sanitizeRequestQuery(req: Request, res: Response, next: NextFunction): void {
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

/**
 * Tüm request parametrelerini sanitize eder
 */
export function sanitizeRequestParams(req: Request, res: Response, next: NextFunction): void {
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  next();
}

/**
 * Tüm request girdilerini sanitize eder
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Body sanitize et
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  // Query sanitize et
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  
  // Params sanitize et
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  
  next();
}

/**
 * Bir nesnenin tüm string değerlerini sanitize eder
 * @param obj - Sanitize edilecek nesne
 */
function sanitizeObject(obj: Record<string, any>): void {
  try {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        
        if (typeof value === 'string') {
          // String değerleri sanitize et
          if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
            // URL alanlarını sanitize et
            obj[key] = sanitizeUrl(value);
          } else if (key.toLowerCase().includes('html') || key.toLowerCase().includes('content')) {
            // HTML içerebilecek alanları sanitize et
            obj[key] = sanitizeXss(value);
          } else {
            // Diğer string alanları sanitize et
            obj[key] = sanitizeAll(value);
          }
        } else if (value !== null && typeof value === 'object') {
          // İç içe nesneleri sanitize et
          sanitizeObject(value);
        }
      }
    }
  } catch (error) {
    logger.error('Sanitizasyon sırasında hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

export default {
  sanitizeRequestBody,
  sanitizeRequestQuery,
  sanitizeRequestParams,
  sanitizeRequest
};
