/**
 * src/utils/queryOptimizer.ts
 * Veritabanı sorgularını optimize etmek için yardımcı fonksiyonlar
 */
import { Query, Document } from 'mongoose';
import { logger } from './logger';

/**
 * Sayfalama seçenekleri
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | string[];
  populate?: string | string[] | Record<string, any>[];
  lean?: boolean;
}

/**
 * Sayfalama meta verileri
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Sayfalama sonucu
 */
export interface PaginationResult<T> {
  data: T[];
  meta: {
    pagination: PaginationMeta;
  };
}

/**
 * Sorguyu sayfalama ile optimize eder
 *
 * @param query - Mongoose sorgusu
 * @param options - Sayfalama seçenekleri
 * @returns Sayfalama sonucu
 */
export async function paginateQuery<T extends Document>(
  query: Query<T[], T>,
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
      paginatedQuery = paginatedQuery.select(options.select);
    }

    // İlişkili belgeleri getir
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach((field) => {
          paginatedQuery = paginatedQuery.populate(field as any);
        });
      } else {
        paginatedQuery = paginatedQuery.populate(options.populate);
      }
    }

    // Lean sorgu (performans için)
    if (options.lean) {
      paginatedQuery = paginatedQuery.lean();
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
      options,
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
export function optimizeQuery<T extends Document>(
  query: Query<any, T>,
  options: {
    select?: string | string[];
    populate?: string | string[] | Record<string, any>[];
    lean?: boolean;
    timeout?: number;
  } = {}
): Query<any, T> {
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
    query = query.lean();
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
  paginateQuery,
  optimizeQuery,
  batchItems,
  processBatch,
};
