/**************************************
 * utils/errors.js
 * Özel hata sınıfları
 **************************************/

/**
 * Temel hata sınıfı
 */
class AppError extends Error {
  /**
   * @param {string} message - Hata mesajı
   * @param {number} statusCode - HTTP durum kodu
   * @param {string} code - Hata kodu
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Kimlik doğrulama hatası
 */
class AuthenticationError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Kimlik doğrulama başarısız', code = 'AUTHENTICATION_ERROR') {
    super(message, 401, code);
  }
}

/**
 * Yetkilendirme hatası
 */
class AuthorizationError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Bu işlem için yetkiniz yok', code = 'AUTHORIZATION_ERROR') {
    super(message, 403, code);
  }
}

/**
 * Bulunamadı hatası
 */
class NotFoundError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Kaynak bulunamadı', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * Doğrulama hatası
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Doğrulama hatası', code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

/**
 * Çakışma hatası
 */
class ConflictError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Kaynak zaten mevcut', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * İstek sınırı aşıldı hatası
 */
class RateLimitError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'İstek sınırı aşıldı', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
  }
}

/**
 * Servis kullanılamıyor hatası
 */
class ServiceUnavailableError extends AppError {
  /**
   * @param {string} message - Hata mesajı
   * @param {string} code - Hata kodu
   */
  constructor(message = 'Servis şu anda kullanılamıyor', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

/**
 * Hata işleyici
 * @param {Error} err - Hata nesnesi
 * @param {Object} req - Express request nesnesi
 * @param {Object} res - Express response nesnesi
 * @param {Function} next - Express next fonksiyonu
 */
function errorHandler(err, req, res, next) {
  // Varsayılan değerler
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Bir hata oluştu';
  let code = err.code || 'INTERNAL_ERROR';
  let isOperational = err.isOperational || false;

  // Mongoose doğrulama hatası
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
    code = 'VALIDATION_ERROR';
    isOperational = true;
  }

  // Mongoose benzersizlik hatası
  if (err.name === 'MongoError' && err.code === 11000) {
    statusCode = 409;
    message = 'Bu kayıt zaten mevcut';
    code = 'DUPLICATE_KEY';
    isOperational = true;
  }

  // JWT hatası
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Geçersiz token';
    code = 'INVALID_TOKEN';
    isOperational = true;
  }

  // JWT süresi dolmuş hatası
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token süresi dolmuş';
    code = 'TOKEN_EXPIRED';
    isOperational = true;
  }

  // Üretim ortamında operasyonel olmayan hataların detaylarını gizle
  if (process.env.NODE_ENV === 'production' && !isOperational) {
    message = 'Bir hata oluştu';
    code = 'INTERNAL_ERROR';
  }

  // Hata yanıtını gönder
  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  errorHandler
};
