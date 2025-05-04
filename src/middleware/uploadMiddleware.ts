/**
 * src/middleware/uploadMiddleware.ts
 * Dosya yükleme middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { FILE_SIZE_LIMITS, ALLOWED_EXTENSIONS, UPLOAD_DIRS } from '../utils/fileProcessor';
import { sanitizeFilename } from '../utils/fileUtils';
import crypto from 'crypto';
import { env } from '../config/env';

// Geçici yükleme dizini
const TEMP_UPLOAD_DIR = UPLOAD_DIRS.temp;

// Geçici yükleme dizinini oluştur
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Multer depolama yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dizinin var olduğundan emin ol
    if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
      fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true, mode: 0o755 });
    }

    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    try {
      // Orijinal dosya adını sanitize et
      const sanitizedName = sanitizeFilename(file.originalname);

      // Dosya uzantısını al
      const extension = path.extname(sanitizedName).toLowerCase();

      // Benzersiz dosya adı oluştur (UUID + hash + uzantı)
      const uuid = uuidv4();
      const hash = crypto
        .createHash('sha256')
        .update(file.originalname + Date.now().toString())
        .digest('hex')
        .substring(0, 8);

      const uniqueFileName = `${uuid}-${hash}${extension}`;

      cb(null, uniqueFileName);
    } catch (error) {
      logger.error('Dosya adı oluşturma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        originalname: file.originalname
      });

      // Hata durumunda varsayılan bir ad kullan
      const fallbackName = `${uuidv4()}.bin`;
      cb(null, fallbackName);
    }
  }
});

// Dosya filtreleme
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // Dosya adını sanitize et
    const sanitizedName = sanitizeFilename(file.originalname);

    // Dosya uzantısını al
    const extension = path.extname(sanitizedName).toLowerCase();

    // Dosya türünü belirle
    const fileType = getFileTypeFromMimeType(file.mimetype, extension);

    // Dosya uzantısını kontrol et
    if (!isAllowedExtension(extension, fileType)) {
      logger.warn('İzin verilmeyen dosya uzantısı', {
        extension,
        fileType,
        originalname: file.originalname,
        mimeType: file.mimetype,
        ip: (req as any).ip
      });

      return cb(new ValidationError(`İzin verilmeyen dosya uzantısı: ${extension}`));
    }

    // Dosya boyutunu kontrol et
    const fileSize = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = FILE_SIZE_LIMITS[fileType as keyof typeof FILE_SIZE_LIMITS];

    if (fileSize > maxSize) {
      logger.warn('Dosya boyutu çok büyük', {
        fileSize,
        maxSize,
        fileType,
        originalname: file.originalname,
        ip: (req as any).ip
      });

      return cb(new ValidationError(`Dosya boyutu çok büyük. Maksimum: ${formatFileSize(maxSize)}`));
    }

    // MIME türünü kontrol et
    if (!isAllowedMimeType(file.mimetype, fileType)) {
      logger.warn('İzin verilmeyen MIME türü', {
        mimeType: file.mimetype,
        fileType,
        originalname: file.originalname,
        ip: (req as any).ip
      });

      return cb(new ValidationError(`İzin verilmeyen dosya türü: ${file.mimetype}`));
    }

    // Dosya kabul edildi
    cb(null, true);
  } catch (error) {
    logger.error('Dosya filtreleme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      originalname: file.originalname,
      mimeType: file.mimetype,
      ip: (req as any).ip
    });

    cb(error as Error);
  }
};

// Dosya boyutunu formatla
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// MIME türünün izin verilip verilmediğini kontrol et
function isAllowedMimeType(mimeType: string, fileType: string): boolean {
  // İzin verilen MIME türleri
  const ALLOWED_MIME_TYPES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'],
    video: ['video/mp4', 'video/webm', 'video/ogg'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/xml'
    ],
    other: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
  };

  return ALLOWED_MIME_TYPES[fileType as keyof typeof ALLOWED_MIME_TYPES].includes(mimeType);
}

// MIME türüne göre dosya türünü belirle
function getFileTypeFromMimeType(mimeType: string, extension: string): string {
  // MIME türüne göre dosya türünü belirle
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown'
  ) {
    return 'document';
  }

  // Uzantıya göre dosya türünü belirle
  const ext = extension.toLowerCase();

  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }

  // Varsayılan olarak diğer
  return 'other';
}

// Dosya uzantısının izin verilip verilmediğini kontrol et
function isAllowedExtension(extension: string, fileType: string): boolean {
  const ext = extension.toLowerCase();
  return ALLOWED_EXTENSIONS[fileType as keyof typeof ALLOWED_EXTENSIONS].includes(ext);
}

// Multer yapılandırması
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(...Object.values(FILE_SIZE_LIMITS)), // En büyük dosya boyutu limiti
    files: 10, // Maksimum dosya sayısı
    parts: 20, // Maksimum form alanı sayısı
    fieldSize: 5 * 1024 * 1024 // Maksimum form alanı boyutu (5MB)
  }
});

// Hata işleme middleware'i
export function handleUploadErrors(err: any, req: Request, res: Response, next: NextFunction) {
  // Hata yoksa devam et
  if (!err) {
    return next();
  }

  // İstemci IP'sini al
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;

  if (err instanceof multer.MulterError) {
    // Multer hatası
    logger.warn('Multer dosya yükleme hatası', {
      code: err.code,
      field: err.field,
      message: err.message,
      ip: clientIp,
      path: req.path
    });

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Dosya boyutu çok büyük',
          statusCode: 400,
          code: 'LIMIT_FILE_SIZE',
          details: {
            maxSize: formatFileSize(Math.max(...Object.values(FILE_SIZE_LIMITS))),
            field: err.field
          }
        }
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Çok fazla dosya yüklemeye çalıştınız',
          statusCode: 400,
          code: 'LIMIT_FILE_COUNT',
          details: {
            maxFiles: 10
          }
        }
      });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Beklenmeyen dosya alanı',
          statusCode: 400,
          code: 'LIMIT_UNEXPECTED_FILE',
          details: {
            field: err.field
          }
        }
      });
    } else if (err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Çok fazla form alanı',
          statusCode: 400,
          code: 'LIMIT_PART_COUNT'
        }
      });
    } else if (err.code === 'LIMIT_FIELD_KEY') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Form alanı adı çok uzun',
          statusCode: 400,
          code: 'LIMIT_FIELD_KEY'
        }
      });
    } else if (err.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Form alanı değeri çok büyük',
          statusCode: 400,
          code: 'LIMIT_FIELD_VALUE'
        }
      });
    } else if (err.code === 'LIMIT_FIELD_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Çok fazla form alanı',
          statusCode: 400,
          code: 'LIMIT_FIELD_COUNT'
        }
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        message: `Dosya yükleme hatası: ${err.message}`,
        statusCode: 400,
        code: err.code
      }
    });
  } else if (err instanceof ValidationError) {
    // Doğrulama hatası
    logger.warn('Dosya doğrulama hatası', {
      message: err.message,
      ip: clientIp,
      path: req.path
    });

    return res.status(400).json({
      success: false,
      error: {
        message: err.message,
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      }
    });
  }

  // Diğer hatalar
  logger.error('Dosya yükleme hatası', {
    error: err.message,
    stack: err.stack,
    ip: clientIp,
    path: req.path
  });

  return res.status(500).json({
    success: false,
    error: {
      message: 'Dosya yüklenirken bir hata oluştu',
      statusCode: 500,
      code: 'UPLOAD_ERROR'
    }
  });
}

/**
 * Dosya yükleme öncesi kontrol middleware'i
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function preUploadCheck(req: Request, res: Response, next: NextFunction) {
  try {
    // İstemci IP'sini al
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;

    // Content-Type kontrolü
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      logger.warn('Geçersiz Content-Type', {
        contentType,
        ip: clientIp,
        path: req.path
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Geçersiz istek formatı. multipart/form-data olmalı',
          statusCode: 400,
          code: 'INVALID_CONTENT_TYPE'
        }
      });
    }

    // Content-Length kontrolü
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = Math.max(...Object.values(FILE_SIZE_LIMITS));

    if (contentLength > maxSize * 1.1) { // %10 tolerans
      logger.warn('İstek boyutu çok büyük', {
        contentLength,
        maxSize,
        ip: clientIp,
        path: req.path
      });

      return res.status(400).json({
        success: false,
        error: {
          message: `İstek boyutu çok büyük. Maksimum: ${formatFileSize(maxSize)}`,
          statusCode: 400,
          code: 'REQUEST_TOO_LARGE'
        }
      });
    }

    // Kullanıcı kimlik doğrulama kontrolü (opsiyonel)
    if (env.REQUIRE_AUTH_FOR_UPLOADS === 'true' && !(req as any).user) {
      logger.warn('Kimlik doğrulama olmadan dosya yükleme denemesi', {
        ip: clientIp,
        path: req.path
      });

      return res.status(401).json({
        success: false,
        error: {
          message: 'Dosya yüklemek için giriş yapmalısınız',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        }
      });
    }

    // Hız sınırlama kontrolü (burada basit bir örnek, gerçek uygulamada daha karmaşık olabilir)
    const uploadLimiter = (req as any).uploadLimiter;
    if (uploadLimiter && uploadLimiter.remaining <= 0) {
      logger.warn('Dosya yükleme hız sınırı aşıldı', {
        ip: clientIp,
        path: req.path,
        remaining: uploadLimiter.remaining,
        resetTime: new Date(uploadLimiter.resetTime).toISOString()
      });

      return res.status(429).json({
        success: false,
        error: {
          message: 'Çok fazla dosya yükleme denemesi. Lütfen daha sonra tekrar deneyin',
          statusCode: 429,
          code: 'TOO_MANY_REQUESTS',
          details: {
            resetTime: new Date(uploadLimiter.resetTime).toISOString()
          }
        }
      });
    }

    // Tüm kontroller geçildi, devam et
    next();
  } catch (error) {
    logger.error('Dosya yükleme öncesi kontrol hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Dosya yükleme işlemi sırasında bir hata oluştu',
        statusCode: 500,
        code: 'SERVER_ERROR'
      }
    });
  }
}

/**
 * Tek dosya yükleme middleware'i
 * @param fieldName - Form alanı adı
 * @returns Middleware dizisi
 */
export function uploadSingleFile(fieldName: string) {
  return [preUploadCheck, upload.single(fieldName), handleUploadErrors];
}

/**
 * Çoklu dosya yükleme middleware'i
 * @param fieldName - Form alanı adı
 * @param maxCount - Maksimum dosya sayısı
 * @returns Middleware dizisi
 */
export function uploadMultipleFiles(fieldName: string, maxCount: number = 5) {
  return [preUploadCheck, upload.array(fieldName, maxCount), handleUploadErrors];
}

/**
 * Farklı alanlarda çoklu dosya yükleme middleware'i
 * @param fields - Alan adları ve maksimum dosya sayıları
 * @returns Middleware dizisi
 */
export function uploadFields(fields: { name: string; maxCount: number }[]) {
  return [preUploadCheck, upload.fields(fields), handleUploadErrors];
}

/**
 * Dosya yükleme sonrası temizlik middleware'i
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function postUploadCleanup(req: Request, res: Response, next: NextFunction) {
  // Geçici dosyaları temizle
  if (req.file) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      logger.warn('Geçici dosya temizleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        path: req.file.path
      });
    }
  }

  if (req.files) {
    try {
      if (Array.isArray(req.files)) {
        // upload.array() kullanıldığında
        req.files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            logger.warn('Geçici dosya temizleme hatası', {
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
              path: file.path
            });
          }
        });
      } else {
        // upload.fields() kullanıldığında
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (error) {
              logger.warn('Geçici dosya temizleme hatası', {
                error: error instanceof Error ? error.message : 'Bilinmeyen hata',
                path: file.path
              });
            }
          });
        });
      }
    } catch (error) {
      logger.warn('Geçici dosyaları temizleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    }
  }

  next();
}

export default {
  uploadSingleFile,
  uploadMultipleFiles,
  uploadFields,
  handleUploadErrors,
  preUploadCheck,
  postUploadCleanup
};
