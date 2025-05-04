/**
 * src/types/index.d.ts
 * Genel tip tanımlamaları
 */

// API yanıt arayüzü
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Sayfalama seçenekleri arayüzü
export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
}

// Filtreleme seçenekleri arayüzü
export interface FilterOptions {
  [key: string]: any;
}

// Sıralama seçenekleri arayüzü
export interface SortOptions {
  [key: string]: 1 | -1;
}

// Sorgu seçenekleri arayüzü
export interface QueryOptions {
  pagination?: PaginationOptions;
  filter?: FilterOptions;
  sort?: SortOptions;
  populate?: string | string[] | Record<string, any>;
  select?: string | string[];
}

// Sayfalama sonucu arayüzü
export interface PaginationResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

// Önbellek seçenekleri arayüzü
export interface CacheOptions {
  key?: string;
  ttl?: number;
  skipCache?: boolean;
}

// Dosya bilgisi arayüzü
export interface FileInfo {
  id: string;
  originalName: string;
  serverFilename: string;
  mimeType: string;
  size: number;
  path: string;
  uploadDate: Date;
  uploader: string;
}

// Kullanıcı durumu arayüzü
export interface UserStatus {
  userId: string;
  username: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  customStatus?: string;
  lastSeen?: Date;
}

// Bildirim arayüzü
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

// Hata arayüzü
export interface ErrorDetails {
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  details?: any;
}
