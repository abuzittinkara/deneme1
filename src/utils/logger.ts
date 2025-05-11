/**
 * src/utils/logger.ts
 * Gelişmiş loglama modülü
 */
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

// Log dizini oluştur
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log seviyelerini tanımla
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log seviyesi renklerini tanımla
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Winston'a renkleri tanıt
winston.addColors(colors);

// Ortam değişkenine göre log seviyesini belirle
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Konsol formatını tanımla
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) =>
      `${info['timestamp'] || ''} ${info.level}: ${info.message} ${info['metadata'] ? JSON.stringify(info['metadata']) : ''}`
  )
);

// Dosya formatını tanımla
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json()
);

// Dönen dosya transport'u oluştur
const createFileTransport = (level: string) => {
  return new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, `%DATE%-${level}.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: fileFormat,
  });
};

// Transport'ları tanımla
const transports = [
  // Konsol transport'u
  new winston.transports.Console({
    format: consoleFormat,
    level: level(),
  }),
  // Hata logları için dosya transport'u
  createFileTransport('error'),
  // Tüm loglar için dosya transport'u
  createFileTransport('combined'),
];

// Logger'ı oluştur
export const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' })
  ),
  transports,
  defaultMeta: {
    service: 'sesli-sohbet',
    hostname: os.hostname(),
    pid: process.pid,
  },
  exitOnError: false,
});

// HTTP istekleri için özel logger
export const httpLogger = {
  log: (message: string, meta?: any) => {
    logger.log('http', message, { metadata: meta });
  },
};

// Express için HTTP request logger middleware'i
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // İstek ID'si oluştur veya mevcut olanı kullan
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;

  // İstek başlangıç zamanı
  const startTime = new Date().getTime();

  // İstek bilgilerini logla
  if (env.NODE_ENV === 'development') {
    const requestBody =
      req.method !== 'GET'
        ? Object.keys(req.body || {}).length > 0
          ? JSON.stringify(sanitizeRequestBody(req.body))
          : '<empty>'
        : undefined;

    logger.debug(`Request: ${req.method} ${req.originalUrl}`, {
      metadata: {
        requestId,
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        params: req.params,
        body: requestBody,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.id || 'anonymous',
      },
    });
  }

  // Response tamamlandığında log oluştur
  res.on('finish', () => {
    const duration = new Date().getTime() - startTime;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    // Status code'a göre log seviyesini belirle
    let level = 'http';
    if (res.statusCode >= 500) {
      level = 'error';
    } else if (res.statusCode >= 400) {
      level = 'warn';
    } else if (duration > 1000) {
      // 1 saniyeden uzun süren istekler için uyarı
      level = 'warn';
    }

    logger.log(level, message, {
      metadata: {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.id || 'anonymous',
        contentLength: res.get('content-length'),
        referrer: req.get('referer') || req.get('referrer'),
      },
    });
  });

  next();
};

// İstek gövdesini temizle (hassas bilgileri gizle)
function sanitizeRequestBody(body: any): any {
  if (!body) return body;

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'secret',
    'apiKey',
    'credit_card',
    'creditCard',
  ];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

// Hata yakalama ve loglama yardımcı fonksiyonu
export const logError = (error: Error, context?: string, metadata?: any) => {
  // Hata ID'si oluştur
  const errorId = uuidv4();

  const errorInfo = {
    errorId,
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: (error as any).code,
    statusCode: (error as any).statusCode,
    context,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  // Hata türüne göre log seviyesini belirle
  const level = isOperationalError(error) ? 'warn' : 'error';

  logger.log(level, `Error [${errorId}]: ${error.message}`, { metadata: errorInfo });

  // Programatik hatalar için ek bilgiler logla
  if (!isOperationalError(error)) {
    logger.error(`Stack trace for error [${errorId}]:`, {
      metadata: {
        stack: error.stack,
        errorId,
      },
    });
  }

  return errorInfo;
};

// Operasyonel hata mı yoksa programatik hata mı olduğunu belirle
function isOperationalError(error: Error): boolean {
  // Bilinen operasyonel hata türleri
  const operationalErrorTypes = [
    'ValidationError',
    'NotFoundError',
    'UnauthorizedError',
    'ForbiddenError',
    'BadRequestError',
    'ConflictError',
    'TimeoutError',
    'RateLimitError',
  ];

  // Özel hata sınıflarımız için kontrol
  if ((error as any).isOperational === true) {
    return true;
  }

  // Hata adına göre kontrol
  if (operationalErrorTypes.includes(error.name)) {
    return true;
  }

  // HTTP durum koduna göre kontrol (4xx hatalar genellikle operasyoneldir)
  if (
    (error as any).statusCode &&
    (error as any).statusCode >= 400 &&
    (error as any).statusCode < 500
  ) {
    return true;
  }

  return false;
}

// Performans ölçümü için yardımcı fonksiyon
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: any
): Promise<T> => {
  const startTime = new Date().getTime();
  try {
    const result = await fn();
    const duration = new Date().getTime() - startTime;

    logger.debug(`Performance: ${name} completed in ${duration}ms`, {
      metadata: {
        operation: name,
        duration,
        ...metadata,
      },
    });

    return result;
  } catch (error) {
    const duration = new Date().getTime() - startTime;

    logError(error as Error, `Performance measurement for ${name}`, {
      operation: name,
      duration,
      ...metadata,
    });

    throw error;
  }
};

// Veritabanı sorguları için özel logger
export const dbLogger = {
  query: (query: string, params?: any[], duration?: number) => {
    logger.debug(`DB Query: ${query}`, {
      metadata: {
        query,
        params,
        duration,
      },
    });
  },
  error: (error: Error, query?: string, params?: any[]) => {
    logError(error, 'Database error', {
      query,
      params,
    });
  },
};

// Socket.IO olayları için özel logger
export const socketLogger = {
  connection: (socketId: string, userId?: string) => {
    logger.info(`Socket connected: ${socketId}`, {
      metadata: {
        socketId,
        userId,
      },
    });
  },
  disconnect: (socketId: string, reason: string) => {
    logger.info(`Socket disconnected: ${socketId}, reason: ${reason}`, {
      metadata: {
        socketId,
        reason,
      },
    });
  },
  event: (socketId: string, event: string, data?: any) => {
    logger.debug(`Socket event: ${event}`, {
      metadata: {
        socketId,
        event,
        data,
      },
    });
  },
  error: (socketId: string, error: Error) => {
    logError(error, 'Socket error', {
      socketId,
    });
  },
};

// Redis olayları için özel logger
export const redisLogger = {
  command: (command: string, args?: any[]) => {
    logger.debug(`Redis command: ${command}`, {
      metadata: {
        command,
        args,
      },
    });
  },
  error: (error: Error, command?: string) => {
    logError(error, 'Redis error', {
      command,
    });
  },
};

export default logger;
