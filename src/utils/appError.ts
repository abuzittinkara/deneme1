/**
 * src/utils/appError.ts
 * Uygulama hata sınıfı
 *
 * @deprecated Bu dosya yerine src/utils/errorManager.ts kullanılmalıdır.
 */
import errorManager, { AppError as BaseAppError } from './errorManager';

/**
 * Uygulama hata sınıfı
 * Tüm uygulama hatalarının temel sınıfı
 *
 * @deprecated Bu sınıf yerine errorManager.AppError kullanılmalıdır.
 */
export class AppError extends BaseAppError {}

/**
 * Doğrulama hatası
 * @deprecated Bu sınıf yerine errorManager.ValidationError kullanılmalıdır.
 */
export class ValidationError extends AppError {}

/**
 * Kimlik doğrulama hatası
 * @deprecated Bu sınıf yerine errorManager.AuthenticationError kullanılmalıdır.
 */
export class AuthenticationError extends AppError {}

/**
 * Yetkilendirme hatası
 * @deprecated Bu sınıf yerine errorManager.AuthorizationError kullanılmalıdır.
 */
export class AuthorizationError extends AppError {}

/**
 * Bulunamadı hatası
 * @deprecated Bu sınıf yerine errorManager.NotFoundError kullanılmalıdır.
 */
export class NotFoundError extends AppError {}

/**
 * Çoğaltma hatası
 * @deprecated Bu sınıf yerine errorManager.ConflictError kullanılmalıdır.
 */
export class DuplicateError extends AppError {}

/**
 * Zaman aşımı hatası
 * @deprecated Bu sınıf yerine errorManager.AppError kullanılmalıdır.
 */
export class TimeoutError extends AppError {}

/**
 * Veritabanı hatası
 * @deprecated Bu sınıf yerine errorManager.DatabaseError kullanılmalıdır.
 */
export class DatabaseError extends AppError {}

/**
 * Sunucu hatası
 * @deprecated Bu sınıf yerine errorManager.ServerError kullanılmalıdır.
 */
export class ServerError extends AppError {}

/**
 * Dış servis hatası
 * @deprecated Bu sınıf yerine errorManager.ExternalServiceError kullanılmalıdır.
 */
export class ExternalServiceError extends AppError {}

/**
 * İstek hatası
 * @deprecated Bu sınıf yerine errorManager.AppError kullanılmalıdır.
 */
export class BadRequestError extends AppError {}

/**
 * Hata fabrikası
 * Hata türüne göre uygun hata nesnesi oluşturur
 *
 * @deprecated Bu fonksiyon yerine errorManager modülü kullanılmalıdır.
 */
export const createError = (type: string, message?: string, details?: any): AppError => {
  // Yeni hata yönetim sistemine yönlendir
  return errorManager.createError(type, message, details);
};

// Geriye dönük uyumluluk için eski hata sınıflarını dışa aktar
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
  createError,

  // Yeni hata yönetim sistemine referans
  errorManager,
};
