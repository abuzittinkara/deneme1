/**
 * src/utils/searchUtils.ts
 * Arama ve filtreleme yardımcı fonksiyonları
 */
import { logger } from './logger';
import { Request } from 'express';
import mongoose from 'mongoose';

/**
 * Sayfalama parametrelerini alır
 * @param req Express isteği
 * @returns Sayfalama parametreleri
 */
export function getPaginationParams(req: Request): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(req.query.page as string || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20')));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Sıralama parametrelerini alır
 * @param req Express isteği
 * @param defaultSortField Varsayılan sıralama alanı
 * @param allowedSortFields İzin verilen sıralama alanları
 * @returns Sıralama parametreleri
 */
export function getSortParams(
  req: Request,
  defaultSortField: string = 'createdAt',
  allowedSortFields: string[] = []
): {
  sortBy: string;
  sortOrder: 1 | -1;
} {
  let sortBy = req.query.sortBy as string || defaultSortField;
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  
  // İzin verilen alanları kontrol et
  if (allowedSortFields.length > 0 && !allowedSortFields.includes(sortBy)) {
    sortBy = defaultSortField;
  }
  
  return { sortBy, sortOrder };
}

/**
 * Arama sorgusu oluşturur
 * @param searchText Arama metni
 * @param searchFields Arama alanları
 * @returns Arama sorgusu
 */
export function createSearchQuery(
  searchText: string,
  searchFields: string[]
): any {
  if (!searchText || searchFields.length === 0) {
    return {};
  }
  
  // Arama sorgusunu oluştur
  const searchQuery = {
    $or: searchFields.map(field => ({
      [field]: { $regex: searchText, $options: 'i' }
    }))
  };
  
  return searchQuery;
}

/**
 * Filtreleme sorgusu oluşturur
 * @param filters Filtreler
 * @returns Filtreleme sorgusu
 */
export function createFilterQuery(
  filters: Record<string, any>
): any {
  if (!filters || Object.keys(filters).length === 0) {
    return {};
  }
  
  const filterQuery: Record<string, any> = {};
  
  // Filtreleri işle
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) {
      continue;
    }
    
    // Özel operatörler
    if (typeof value === 'object' && !Array.isArray(value)) {
      const operators: Record<string, any> = {};
      
      for (const [op, opValue] of Object.entries(value)) {
        if (opValue === undefined || opValue === null) {
          continue;
        }
        
        switch (op) {
          case 'eq':
            operators.$eq = opValue;
            break;
          case 'ne':
            operators.$ne = opValue;
            break;
          case 'gt':
            operators.$gt = opValue;
            break;
          case 'gte':
            operators.$gte = opValue;
            break;
          case 'lt':
            operators.$lt = opValue;
            break;
          case 'lte':
            operators.$lte = opValue;
            break;
          case 'in':
            operators.$in = Array.isArray(opValue) ? opValue : [opValue];
            break;
          case 'nin':
            operators.$nin = Array.isArray(opValue) ? opValue : [opValue];
            break;
          case 'regex':
            operators.$regex = opValue;
            operators.$options = 'i';
            break;
          case 'exists':
            operators.$exists = Boolean(opValue);
            break;
        }
      }
      
      if (Object.keys(operators).length > 0) {
        filterQuery[key] = operators;
      }
    }
    // Dizi değerleri
    else if (Array.isArray(value)) {
      filterQuery[key] = { $in: value };
    }
    // Boolean değerleri
    else if (typeof value === 'boolean') {
      filterQuery[key] = value;
    }
    // String değerleri
    else if (typeof value === 'string') {
      // ObjectId kontrolü
      if (key.endsWith('Id') && mongoose.Types.ObjectId.isValid(value)) {
        filterQuery[key] = new mongoose.Types.ObjectId(value);
      } else {
        filterQuery[key] = value;
      }
    }
    // Sayısal değerler
    else if (typeof value === 'number') {
      filterQuery[key] = value;
    }
  }
  
  return filterQuery;
}

/**
 * Tarih aralığı sorgusu oluşturur
 * @param field Tarih alanı
 * @param startDate Başlangıç tarihi
 * @param endDate Bitiş tarihi
 * @returns Tarih aralığı sorgusu
 */
export function createDateRangeQuery(
  field: string,
  startDate?: string | Date,
  endDate?: string | Date
): any {
  if (!startDate && !endDate) {
    return {};
  }
  
  const dateQuery: Record<string, any> = {};
  
  if (startDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    dateQuery.$gte = start;
  }
  
  if (endDate) {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    dateQuery.$lte = end;
  }
  
  return { [field]: dateQuery };
}

/**
 * Arama ve filtreleme parametrelerini alır
 * @param req Express isteği
 * @param options Seçenekler
 * @returns Arama ve filtreleme parametreleri
 */
export function getSearchAndFilterParams(
  req: Request,
  options: {
    searchFields?: string[];
    allowedFilters?: string[];
    allowedSortFields?: string[];
    defaultSortField?: string;
  } = {}
): {
  searchQuery: any;
  filterQuery: any;
  sortParams: { sortBy: string; sortOrder: 1 | -1 };
  paginationParams: { page: number; limit: number; skip: number };
} {
  try {
    // Sayfalama parametrelerini al
    const paginationParams = getPaginationParams(req);
    
    // Sıralama parametrelerini al
    const sortParams = getSortParams(
      req,
      options.defaultSortField,
      options.allowedSortFields
    );
    
    // Arama sorgusunu oluştur
    const searchText = req.query.search as string;
    const searchQuery = options.searchFields
      ? createSearchQuery(searchText, options.searchFields)
      : {};
    
    // Filtreleme sorgusunu oluştur
    const filters: Record<string, any> = {};
    
    if (options.allowedFilters) {
      for (const filter of options.allowedFilters) {
        if (req.query[filter] !== undefined) {
          filters[filter] = req.query[filter];
        }
      }
    }
    
    const filterQuery = createFilterQuery(filters);
    
    // Tarih aralığı sorgusunu oluştur
    if (req.query.startDate || req.query.endDate) {
      const dateField = req.query.dateField as string || 'createdAt';
      const dateRangeQuery = createDateRangeQuery(
        dateField,
        req.query.startDate as string,
        req.query.endDate as string
      );
      
      Object.assign(filterQuery, dateRangeQuery);
    }
    
    return {
      searchQuery,
      filterQuery,
      sortParams,
      paginationParams
    };
  } catch (error) {
    logger.error('Arama ve filtreleme parametreleri alınırken hata oluştu', { 
      error: (error as Error).message,
      query: req.query
    });
    
    // Varsayılan değerleri döndür
    return {
      searchQuery: {},
      filterQuery: {},
      sortParams: { sortBy: 'createdAt', sortOrder: -1 },
      paginationParams: { page: 1, limit: 20, skip: 0 }
    };
  }
}

/**
 * Arama sonuçlarını formatlar
 * @param results Sonuçlar
 * @param total Toplam sonuç sayısı
 * @param paginationParams Sayfalama parametreleri
 * @returns Formatlanmış sonuçlar
 */
export function formatSearchResults<T>(
  results: T[],
  total: number,
  paginationParams: { page: number; limit: number; skip: number }
): {
  results: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
} {
  const { page, limit } = paginationParams;
  const pages = Math.ceil(total / limit);
  
  return {
    results,
    pagination: {
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1
    }
  };
}

export default {
  getPaginationParams,
  getSortParams,
  createSearchQuery,
  createFilterQuery,
  createDateRangeQuery,
  getSearchAndFilterParams,
  formatSearchResults
};
