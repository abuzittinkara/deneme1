/**
 * src/utils/db-helpers.ts
 * MongoDB veritabanı yardımcı fonksiyonları
 */
import mongoose from 'mongoose';
import { logger } from './logger';
import { measureSync, measure } from './performanceTracker';

/**
 * Belirtilen fonksiyonu yeniden deneme mekanizması ile çalıştırır
 *
 * @param fn - Çalıştırılacak fonksiyon
 * @param options - Yeniden deneme seçenekleri
 * @returns Fonksiyon sonucu
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    timeout?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const retries = options.retries || 3;
  const delay = options.delay || 1000;
  const backoff = options.backoff || 2;
  const timeout = options.timeout || 30000;
  const onRetry = options.onRetry;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      // Zaman aşımı kontrolü
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`İşlem zaman aşımına uğradı (${timeout}ms)`));
        }, timeout);
      });

      // Asıl işlemi çalıştır
      const result = await Promise.race([fn(), timeoutPromise]);
      return result as T;
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Son deneme başarısız olduysa hatayı fırlat
      if (attempt > retries) {
        break;
      }

      // Yeniden deneme geri çağırma fonksiyonunu çağır
      if (onRetry) {
        onRetry(lastError, attempt);
      }

      // Yeniden denemeden önce bekle (üstel geri çekilme)
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

/**
 * Sayfalama parametrelerini alır
 *
 * @param query - Sorgu parametreleri
 * @returns Sayfalama parametreleri
 */
export function getPaginationParams(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query['page'] as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query['limit'] as string) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Sorgu filtrelerini oluşturur
 *
 * @param query - Sorgu parametreleri
 * @param allowedFilters - İzin verilen filtreler
 * @returns Filtreler
 */
export function buildQueryFilters(
  query: Record<string, any>,
  allowedFilters: string[] = []
): Record<string, any> {
  const filters: Record<string, any> = {};

  // İzin verilen filtreleri ekle
  for (const key of allowedFilters) {
    if (query[key] !== undefined) {
      // Özel filtre işlemleri
      if (key.endsWith('_gt')) {
        const baseKey = key.replace('_gt', '');
        filters[baseKey] = { $gt: query[key] };
      } else if (key.endsWith('_gte')) {
        const baseKey = key.replace('_gte', '');
        filters[baseKey] = { $gte: query[key] };
      } else if (key.endsWith('_lt')) {
        const baseKey = key.replace('_lt', '');
        filters[baseKey] = { $lt: query[key] };
      } else if (key.endsWith('_lte')) {
        const baseKey = key.replace('_lte', '');
        filters[baseKey] = { $lte: query[key] };
      } else if (key.endsWith('_ne')) {
        const baseKey = key.replace('_ne', '');
        filters[baseKey] = { $ne: query[key] };
      } else if (key.endsWith('_in')) {
        const baseKey = key.replace('_in', '');
        const values = Array.isArray(query[key]) ? query[key] : query[key].split(',');
        filters[baseKey] = { $in: values };
      } else if (key.endsWith('_nin')) {
        const baseKey = key.replace('_nin', '');
        const values = Array.isArray(query[key]) ? query[key] : query[key].split(',');
        filters[baseKey] = { $nin: values };
      } else if (key.endsWith('_regex')) {
        const baseKey = key.replace('_regex', '');
        // Güvenli regex oluştur
        const sanitizedText = typeof query[key] === 'string' ? query[key].trim() : '';
        if (sanitizedText) {
          const escapedText = sanitizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filters[baseKey] = { $regex: new RegExp(escapedText, 'i') };
        }
      } else if (key.endsWith('_exists')) {
        const baseKey = key.replace('_exists', '');
        filters[baseKey] = { $exists: query[key] === 'true' };
      } else {
        // Standart filtre
        filters[key] = query[key];
      }
    }
  }

  return filters;
}

/**
 * Sorgu performansını izler
 *
 * @param model - Mongoose modeli
 */
export function monitorQueryPerformance(model: any) {
  // Orijinal fonksiyonları kaydet
  const originalFind = model.find;
  const originalFindOne = model.findOne;
  const originalFindById = model.findById;
  const originalUpdateOne = model.updateOne;
  const originalUpdateMany = model.updateMany;
  const originalDeleteOne = model.deleteOne;
  const originalDeleteMany = model.deleteMany;

  // find metodunu izle
  model.find = function (...args: any[]) {
    const startTime = Date.now();
    const result = originalFind.apply(this, args);

    // Sorgu çalıştırıldığında süreyi ölç
    const originalExec = result.exec;
    result.exec = async function () {
      try {
        const data = await originalExec.apply(this, arguments);
        const duration = Date.now() - startTime;

        // Yavaş sorguları logla (100ms'den uzun süren sorgular)
        if (duration > 100) {
          logger.warn('Yavaş sorgu tespit edildi', {
            model: model.modelName,
            method: 'find',
            filter: JSON.stringify(args[0] || {}),
            duration: `${duration}ms`,
          });
        }

        return data;
      } catch (error) {
        logger.error('Sorgu hatası', {
          model: model.modelName,
          method: 'find',
          filter: JSON.stringify(args[0] || {}),
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
        throw error;
      }
    };

    return result;
  };

  // Diğer metodlar için benzer izleme eklenebilir
}

/**
 * Veritabanı bağlantısını izler
 */
export function monitorDatabaseConnection() {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB bağlantısı kuruldu');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB bağlantısı kesildi');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB bağlantı hatası', {
      error: err.message,
      stack: err.stack,
    });
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB bağlantısı yeniden kuruldu');
  });
}

/**
 * Bağlantı istatistiklerini loglar
 */
export function logConnectionStats() {
  if (mongoose.connection.readyState === 1) {
    const stats = {
      collections: Object.keys(mongoose.connection.collections).length,
      models: Object.keys(mongoose.models).length,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };

    logger.info('MongoDB bağlantı istatistikleri', { stats });
  } else {
    logger.warn('MongoDB bağlantısı aktif değil');
  }
}

/**
 * Koleksiyon istatistiklerini loglar
 *
 * @param collectionName - Koleksiyon adı
 */
export async function logCollectionStats(collectionName: string) {
  try {
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB bağlantısı aktif değil');
      return;
    }

    const db = mongoose.connection.db;
    // @ts-ignore - stats metodu TypeScript tanımlarında yok ama MongoDB'de var
    const stats = await db.collection(collectionName).stats();

    logger.info(`${collectionName} koleksiyon istatistikleri`, {
      count: stats.count,
      size: stats.size,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      indexes: stats.nindexes,
      indexSize: stats.totalIndexSize,
    });
  } catch (error) {
    logger.error(`${collectionName} koleksiyon istatistikleri alınamadı`, {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
}

/**
 * İndeksleri oluşturur
 *
 * @param models - Mongoose modelleri
 */
export async function createIndexes(models: any[]) {
  try {
    for (const model of models) {
      await model.createIndexes();
      logger.info(`${model.modelName} indeksleri oluşturuldu`);
    }
  } catch (error) {
    logger.error('İndeksler oluşturulurken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
}

/**
 * Veritabanı bağlantısını optimize eder
 */
export function optimizeDatabaseConnection() {
  // Bağlantı havuzu boyutunu ayarla
  mongoose.set('bufferCommands', false);

  // Sorgu izleme
  mongoose.set('debug', (collectionName: string, methodName: string, ...methodArgs: any[]) => {
    // Geliştirme modunda veya düşük olasılıkla sorguları logla
    if (
      process.env['NODE_ENV'] === 'development' ||
      process.env['LOG_QUERIES'] === 'true' ||
      (process.env['SAMPLE_QUERIES'] === 'true' && require('crypto').randomInt(0, 100) < 1)
    ) {
      logger.debug(`MongoDB Sorgu: ${collectionName}.${methodName}`, {
        metadata: {
          collection: collectionName,
          method: methodName,
          args: methodArgs.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg)),
        },
      });
    }
  });

  logger.info('MongoDB bağlantısı optimize edildi');
}

/**
 * Sorguyu sayfalama ile optimize eder
 *
 * @param query - Mongoose sorgusu
 * @param options - Sayfalama seçenekleri
 * @returns Sayfalama sonucu
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | string[];
  populate?: string | string[] | Record<string, any>[];
  lean?: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationResult<T> {
  data: T[];
  meta: {
    pagination: PaginationMeta;
  };
}

export async function paginateQuery<T>(
  query: mongoose.Query<T[], any>,
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  try {
    // Varsayılan değerler
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    // Toplam sayıyı al
    const total = await query.model.countDocuments(query.getFilter());

    // Sorguyu yapılandır
    let paginatedQuery = query.skip(skip).limit(limit);

    // Sıralama
    if (options.sort) {
      paginatedQuery = paginatedQuery.sort(options.sort);
    }

    // Alan seçimi
    if (options.select) {
      paginatedQuery = paginatedQuery.select(options.select) as any;
    }

    // İlişkili belgeleri getir
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach((field) => {
          paginatedQuery = paginatedQuery.populate(field as any) as any;
        });
      } else {
        paginatedQuery = paginatedQuery.populate(options.populate) as any;
      }
    }

    // Lean sorgu (performans için)
    if (options.lean) {
      // TypeScript ile uyumlu hale getir
      paginatedQuery = paginatedQuery.lean<T[]>();
    }

    // Sorguyu çalıştır
    const data = await paginatedQuery.exec();

    // Sayfalama meta verilerini hesapla
    const pages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNextPage: page < pages,
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    logger.error('Sayfalama sorgusu hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      filter: query.getFilter(),
    });

    throw error;
  }
}

/**
 * Sorguyu optimize eder (projection, lean, vb.)
 *
 * @param query - Mongoose sorgusu
 * @param options - Sorgu seçenekleri
 * @returns Optimize edilmiş sorgu
 */
export function optimizeQuery<T>(
  query: mongoose.Query<any, T>,
  options: {
    select?: string | string[];
    populate?: string | string[] | Record<string, any>[];
    lean?: boolean;
    timeout?: number;
  } = {}
): mongoose.Query<any, T> {
  // Alan seçimi
  if (options.select) {
    query = query.select(options.select);
  }

  // İlişkili belgeleri getir
  if (options.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach((field) => {
        query = query.populate(field as any);
      });
    } else {
      query = query.populate(options.populate);
    }
  }

  // Lean sorgu (performans için)
  if (options.lean !== false) {
    // TypeScript ile uyumlu hale getir
    query = query.lean<T>();
  }

  // Sorgu zaman aşımı
  if (options.timeout) {
    query = query.maxTimeMS(options.timeout);
  }

  return query;
}

/**
 * Toplu işlem için belgeleri gruplar
 *
 * @param items - İşlenecek öğeler
 * @param batchSize - Grup boyutu
 * @returns Gruplar
 */
export function batchItems<T>(items: T[], batchSize: number = 100): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Toplu işlem yapar
 *
 * @param items - İşlenecek öğeler
 * @param processFn - İşlem fonksiyonu
 * @param batchSize - Grup boyutu
 * @returns İşlem sonuçları
 */
export async function processBatch<T, R>(
  items: T[],
  processFn: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  const batches = batchItems(items, batchSize);
  const results: R[] = [];

  for (const batch of batches) {
    const batchResults = await processFn(batch);
    results.push(...batchResults);
  }

  return results;
}

export default {
  executeWithRetry,
  getPaginationParams,
  buildQueryFilters,
  monitorQueryPerformance,
  monitorDatabaseConnection,
  logConnectionStats,
  logCollectionStats,
  createIndexes,
  optimizeDatabaseConnection,
  paginateQuery,
  optimizeQuery,
  batchItems,
  processBatch,
};
