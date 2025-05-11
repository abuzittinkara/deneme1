/**
 * src/utils/error-helpers.ts
 * Hata işleme yardımcı fonksiyonları
 */
import { ErrorCodes, AppError } from './errors';

/**
 * Hatanın operasyonel olup olmadığını kontrol eder
 * @param error - Kontrol edilecek hata
 * @returns Operasyonel hata mı?
 */
export function isOperationalError(error: any): boolean {
  if (!error) return false;

  return error instanceof AppError && error.isOperational === true;
}

/**
 * Hata yanıtını formatlar
 * @param error - Formatlanacak hata
 * @returns Formatlanmış hata yanıtı
 */
export function formatErrorResponse(error: any): any {
  // Hata yoksa veya tanımsızsa
  if (!error) {
    return {
      success: false,
      message: 'Unknown error',
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    };
  }

  // String hata
  if (typeof error === 'string') {
    return {
      success: false,
      message: error,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    };
  }

  // AppError
  if (error instanceof AppError) {
    const response: any = {
      success: false,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };

    // Geliştirme modunda ek bilgiler ekle
    if (process.env.NODE_ENV === 'development' && error.details) {
      response.details = error.details;
    }

    return response;
  }

  // Standart Error
  return {
    success: false,
    message: error.message || 'Internal server error',
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    statusCode: 500,
  };
}
