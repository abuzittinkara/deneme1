/**
 * src/utils/db-error-handler.ts
 * Veritabanı hatalarını yönetmek için yardımcı fonksiyonlar
 */
import mongoose from 'mongoose';
import { logger } from './logger';
import { AppError, ErrorCodes } from './errors';
import { isDatabaseReady, retryDatabaseConnection } from '../config/database';

/**
 * Veritabanı hatalarını işler ve uygun hata nesnesi döndürür
 * @param error - Yakalanan hata
 * @param context - Hata bağlamı
 * @returns İşlenmiş hata
 */
export function handleDatabaseError(error: any, context: string): AppError {
  // Hata tipini belirle
  if (error.name === 'ValidationError') {
    // Mongoose doğrulama hatası
    return new AppError(
      `Doğrulama hatası: ${error.message}`,
      400,
      ErrorCodes.VALIDATION_ERROR,
      true,
      error.errors
    );
  } else if (error.name === 'MongoServerError' && error.code === 11000) {
    // MongoDB benzersizlik hatası
    return new AppError(
      'Bu kayıt zaten mevcut',
      409,
      ErrorCodes.DUPLICATE_KEY,
      true,
      error.keyValue
    );
  } else if (error.name === 'CastError') {
    // Mongoose tip dönüşüm hatası
    return new AppError(`Geçersiz ID formatı: ${error.value}`, 400, ErrorCodes.INVALID_ID, true, {
      path: error.path,
      value: error.value,
    });
  } else if (
    error.name === 'MongoNetworkError' ||
    error.message.includes('buffering timed out') ||
    error.message.includes('connection') ||
    error.message.includes('timeout')
  ) {
    // MongoDB bağlantı hatası
    logger.error('Veritabanı bağlantı hatası', {
      error: error.message,
      context,
      isConnected: isDatabaseReady(),
    });

    // Bağlantıyı yeniden denemeyi başlat
    setTimeout(() => {
      retryDatabaseConnection().catch((err) => {
        logger.error('Veritabanı bağlantısı yeniden denenirken hata oluştu', {
          error: err.message,
        });
      });
    }, 1000);

    return new AppError(
      'Veritabanı bağlantı hatası, lütfen daha sonra tekrar deneyin',
      503,
      ErrorCodes.DATABASE_CONNECTION_ERROR,
      true
    );
  } else {
    // Diğer veritabanı hataları
    logger.error('Veritabanı hatası', {
      error: error.message,
      stack: error.stack,
      context,
    });

    return new AppError(
      'Veritabanı işlemi sırasında bir hata oluştu',
      500,
      ErrorCodes.DATABASE_ERROR,
      true
    );
  }
}

/**
 * Veritabanı işlemlerini güvenli bir şekilde çalıştırır
 * @param operation - Çalıştırılacak veritabanı işlemi
 * @param context - İşlem bağlamı
 * @param fallback - Hata durumunda dönecek varsayılan değer (opsiyonel)
 * @returns İşlem sonucu veya hata durumunda fallback değeri
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    // Veritabanı bağlantısını kontrol et
    if (!isDatabaseReady()) {
      logger.warn('Veritabanı bağlantısı hazır değil, işlem atlanıyor', { context });

      // Bağlantıyı yeniden denemeyi başlat
      setTimeout(() => {
        retryDatabaseConnection().catch((err) => {
          logger.error('Veritabanı bağlantısı yeniden denenirken hata oluştu', {
            error: err.message,
          });
        });
      }, 1000);

      if (fallback !== undefined) {
        return fallback;
      }

      throw new AppError(
        'Veritabanı bağlantısı hazır değil, lütfen daha sonra tekrar deneyin',
        503,
        ErrorCodes.DATABASE_CONNECTION_ERROR,
        true
      );
    }

    // İşlemi çalıştır
    return await operation();
  } catch (error) {
    // Hata durumunda fallback değeri varsa döndür
    if (fallback !== undefined) {
      logger.warn('Veritabanı işlemi başarısız, varsayılan değer döndürülüyor', {
        error: (error as Error).message,
        context,
      });
      return fallback;
    }

    // Hatayı işle ve fırlat
    const processedError = handleDatabaseError(error, context);
    throw processedError;
  }
}

/**
 * Mongoose model metodlarını güvenli hale getiren yardımcı fonksiyon
 * @param model - Mongoose model
 * @returns Güvenli model metodları
 */
export function createSafeModelHelper(model: mongoose.Model<any>) {
  const modelName = model.modelName;

  return {
    /**
     * Güvenli findOne
     */
    findOne: async (filter: any, projection?: any, options?: any) => {
      return safeDbOperation(
        () => model.findOne(filter, projection, options).exec(),
        `${modelName}.findOne`
      );
    },

    /**
     * Güvenli findById
     */
    findById: async (id: any, projection?: any, options?: any) => {
      return safeDbOperation(
        () => model.findById(id, projection, options).exec(),
        `${modelName}.findById`
      );
    },

    /**
     * Güvenli find
     */
    find: async (filter: any, projection?: any, options?: any) => {
      return safeDbOperation(
        () => model.find(filter, projection, options).exec(),
        `${modelName}.find`,
        [] // Hata durumunda boş dizi döndür
      );
    },

    /**
     * Güvenli create
     */
    create: async (data: any) => {
      return safeDbOperation(() => model.create(data), `${modelName}.create`);
    },

    /**
     * Güvenli updateOne
     */
    updateOne: async (filter: any, update: any, options?: any) => {
      return safeDbOperation(
        () => model.updateOne(filter, update, options).exec(),
        `${modelName}.updateOne`
      );
    },

    /**
     * Güvenli deleteOne
     */
    deleteOne: async (filter: any) => {
      return safeDbOperation(() => model.deleteOne(filter).exec(), `${modelName}.deleteOne`);
    },

    /**
     * Model referansını döndür
     */
    getModel: () => model,
  };
}

export default {
  handleDatabaseError,
  safeDbOperation,
  createSafeModelHelper,
};
