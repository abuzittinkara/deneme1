/**
 * src/middleware/pagination.ts
 * Sayfalama middleware'i
 */
import { Request, Response, NextFunction } from 'express';

// Sayfalama parametreleri için interface
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// Request nesnesini genişletme
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

/**
 * Sayfalama middleware'i
 * @param defaultLimit - Varsayılan sayfa başına öğe sayısı
 * @param maxLimit - İzin verilen maksimum sayfa başına öğe sayısı
 */
export function paginationMiddleware(defaultLimit = 20, maxLimit = 100) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const requestedLimit = parseInt(req.query['limit'] as string) || defaultLimit;
    const limit = Math.min(requestedLimit, maxLimit);

    req.pagination = {
      page,
      limit,
      skip: (page - 1) * limit,
    };

    next();
  };
}

/**
 * Sayfalama meta bilgilerini oluşturur
 * @param total - Toplam öğe sayısı
 * @param pagination - Sayfalama parametreleri
 */
export function createPaginationMeta(total: number, pagination: PaginationParams) {
  const { page, limit, skip } = pagination;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

/**
 * Sayfalanmış sonuçları döndürür
 * @param data - Veri dizisi
 * @param meta - Sayfalama meta bilgileri
 */
export function paginatedResponse(data: any[], meta: any) {
  return {
    data,
    meta,
  };
}
