/**
 * src/utils/appError.ts
 * Uygulama hata sınıfı
 */

/**
 * Uygulama hata sınıfı
 * Tüm uygulama hatalarının temel sınıfı
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;
  
  /**
   * AppError constructor
   * @param message - Hata mesajı
   * @param statusCode - HTTP durum kodu
   * @param code - Hata kodu
   * @param details - Hata detayları
   */
  constructor(message: string, statusCode = 500, code = 'SERVER_ERROR', details?: any) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Varsayılan olarak operasyonel hata
    this.details = details;
    
    // Hata adını ayarla
    this.name = this.constructor.name;
    
    // Hata yığınını düzgün yakala
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Doğrulama hatası
 */
export class ValidationError extends AppError {
  /**
   * ValidationError constructor
   * @param message - Hata mesajı
   * @param details - Doğrulama hatası detayları
   */
  constructor(message = 'Doğrulama hatası', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Kimlik doğrulama hatası
 */
export class AuthenticationError extends AppError {
  /**
   * AuthenticationError constructor
   * @param message - Hata mesajı
   */
  constructor(message = 'Kimlik doğrulama hatası') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Yetkilendirme hatası
 */
export class AuthorizationError extends AppError {
  /**
   * AuthorizationError constructor
   * @param message - Hata mesajı
   */
  constructor(message = 'Bu işlem için yetkiniz yok') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Bulunamadı hatası
 */
export class NotFoundError extends AppError {
  /**
   * NotFoundError constructor
   * @param message - Hata mesajı
   */
  constructor(message = 'Kaynak bulunamadı') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Çoğaltma hatası
 */
export class DuplicateError extends AppError {
  /**
   * DuplicateError constructor
   * @param message - Hata mesajı
   * @param details - Çoğaltma hatası detayları
   */
  constructor(message = 'Kayıt zaten mevcut', details?: any) {
    super(message, 409, 'DUPLICATE_ERROR', details);
  }
}

/**
 * Zaman aşımı hatası
 */
export class TimeoutError extends AppError {
  /**
   * TimeoutError constructor
   * @param message - Hata mesajı
   */
  constructor(message = 'İşlem zaman aşımına uğradı') {
    super(message, 408, 'TIMEOUT_ERROR');
  }
}

/**
 * Veritabanı hatası
 */
export class DatabaseError extends AppError {
  /**
   * DatabaseError constructor
   * @param message - Hata mesajı
   * @param details - Veritabanı hatası detayları
   */
  constructor(message = 'Veritabanı hatası', details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

/**
 * Sunucu hatası
 */
export class ServerError extends AppError {
  /**
   * ServerError constructor
   * @param message - Hata mesajı
   * @param details - Sunucu hatası detayları
   */
  constructor(message = 'Sunucu hatası', details?: any) {
    super(message, 500, 'SERVER_ERROR', details);
  }
}

/**
 * Dış servis hatası
 */
export class ExternalServiceError extends AppError {
  /**
   * ExternalServiceError constructor
   * @param message - Hata mesajı
   * @param details - Dış servis hatası detayları
   */
  constructor(message = 'Dış servis hatası', details?: any) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

/**
 * İstek hatası
 */
export class BadRequestError extends AppError {
  /**
   * BadRequestError constructor
   * @param message - Hata mesajı
   * @param details - İstek hatası detayları
   */
  constructor(message = 'Geçersiz istek', details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

/**
 * Hata fabrikası
 * Hata türüne göre uygun hata nesnesi oluşturur
 */
export const createError = (
  type: string,
  message?: string,
  details?: any
): AppError => {
  switch (type.toLowerCase()) {
    case 'validation':
      return new ValidationError(message, details);
    case 'authentication':
      return new AuthenticationError(message);
    case 'authorization':
      return new AuthorizationError(message);
    case 'notfound':
      return new NotFoundError(message);
    case 'duplicate':
      return new DuplicateError(message, details);
    case 'timeout':
      return new TimeoutError(message);
    case 'database':
      return new DatabaseError(message, details);
    case 'server':
      return new ServerError(message, details);
    case 'externalservice':
      return new ExternalServiceError(message, details);
    case 'badrequest':
      return new BadRequestError(message, details);
    default:
      return new AppError(message || 'Uygulama hatası');
  }
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DuplicateError,
  TimeoutError,
  DatabaseError,
  ServerError,
  ExternalServiceError,
  BadRequestError,
  createError
};
