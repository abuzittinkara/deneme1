/**
 * src/types/express.d.ts
 * Express için özel tip tanımlamaları
 */
import { Request } from 'express';
import { TokenPayload } from '../config/jwt';
import { JwtPayload } from '../utils/jwt';

// Express Request nesnesini genişlet
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & JwtPayload & {
        id: string; // sub alanının takma adı
        username?: string;
      };
      token?: string;
      refreshToken?: string;
      pagination?: {
        page: number;
        limit: number;
        skip: number;
      };
      filter?: Record<string, any>;
      sort?: Record<string, 1 | -1>;
    }
  }
}

// Kimlik doğrulama ile genişletilmiş istek arayüzü
export interface AuthenticatedRequest extends Request {
  user: TokenPayload & JwtPayload & {
    id: string; // sub alanının takma adı
  }; // Burada opsiyonel değil, zorunlu
}

// Sayfalama ile genişletilmiş istek arayüzü
export interface PaginatedRequest extends Request {
  pagination: {
    page: number;
    limit: number;
    skip: number;
  };
}

// Filtreleme ile genişletilmiş istek arayüzü
export interface FilteredRequest extends Request {
  filter: Record<string, any>;
}

// Sıralama ile genişletilmiş istek arayüzü
export interface SortedRequest extends Request {
  sort: Record<string, 1 | -1>;
}

// Tüm özellikleri içeren istek arayüzü
export interface FullRequest extends AuthenticatedRequest, PaginatedRequest, FilteredRequest, SortedRequest {}
