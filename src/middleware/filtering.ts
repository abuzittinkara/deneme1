/**
 * src/middleware/filtering.ts
 * Filtreleme middleware'i
 */
import { Request, Response, NextFunction } from 'express';

// Filtreleme parametreleri için interface
export interface FilterConfig {
  field: string;
  queryParam?: string;
  transform?: (value: string) => any;
}

// Request nesnesini genişletme
declare global {
  namespace Express {
    interface Request {
      filters?: Record<string, any>;
    }
  }
}

/**
 * Filtreleme middleware'i
 * @param filterConfigs - İzin verilen filtrelerin yapılandırması
 */
export function filteringMiddleware(filterConfigs: FilterConfig[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const filters: Record<string, any> = {};
    
    for (const config of filterConfigs) {
      const queryParam = config.queryParam || config.field;
      const value = req.query[queryParam] as string;
      
      if (value !== undefined) {
        // Değeri dönüştür (varsa)
        const transformedValue = config.transform ? config.transform(value) : value;
        filters[config.field] = transformedValue;
      }
    }
    
    req.filters = filters;
    next();
  };
}

/**
 * Tarih aralığı filtresi oluşturur
 * @param field - Filtrelenecek alan
 * @param startDate - Başlangıç tarihi
 * @param endDate - Bitiş tarihi
 */
export function createDateRangeFilter(field: string, startDate?: string, endDate?: string) {
  const filter: Record<string, any> = {};
  
  if (startDate || endDate) {
    filter[field] = {};
    
    if (startDate) {
      filter[field].$gte = new Date(startDate);
    }
    
    if (endDate) {
      filter[field].$lte = new Date(endDate);
    }
  }
  
  return filter;
}

/**
 * Arama filtresi oluşturur
 * @param fields - Aranacak alanlar
 * @param searchTerm - Arama terimi
 */
export function createSearchFilter(fields: string[], searchTerm?: string) {
  if (!searchTerm) return {};
  
  return {
    $or: fields.map(field => ({
      [field]: { $regex: searchTerm, $options: 'i' }
    }))
  };
}
