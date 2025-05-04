/**
 * src/types/global.d.ts
 * Global tip tanımlamaları
 */

// Node.js için global tip tanımlamaları
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    HOST?: string;

    // MongoDB bağlantı bilgileri
    MONGODB_URI?: string;
    MONGODB_DB_NAME?: string;

    // JWT ayarları
    JWT_SECRET: string;
    JWT_EXPIRES_IN?: string;
    JWT_REFRESH_SECRET?: string;
    JWT_REFRESH_EXPIRES_IN?: string;

    // Redis ayarları
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_PASSWORD?: string;
    REDIS_DB?: string;

    // E-posta ayarları
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASS?: string;
    EMAIL_FROM?: string;

    // Dosya yükleme ayarları
    UPLOAD_DIR?: string;
    MAX_FILE_SIZE?: string;

    // Sentry ayarları
    SENTRY_DSN?: string;

    // Mediasoup ayarları
    MEDIASOUP_WORKER_COUNT?: string;
    MEDIASOUP_LISTEN_IP?: string;
    MEDIASOUP_ANNOUNCED_IP?: string;

    // Diğer ayarlar
    API_BASE_URL?: string;
    CLIENT_URL?: string;
    CORS_ORIGIN?: string;
    LOG_LEVEL?: string;
  }
}

// Express için tip genişletmeleri
declare namespace Express {
  interface Request {
    user?: {
      id?: string;
      username?: string;
      role?: string;
      sub?: string;
      _id?: any;
      [key: string]: any;
    };
    token?: string;
    requestId?: string;
  }
}

// Global yardımcı tipler
interface Dictionary<T> {
  [key: string]: T;
}

interface NumericDictionary<T> {
  [key: number]: T;
}

// Genel hata tipi
interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  details?: any;
}

// Genel API yanıt tipi
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  timestamp?: string;
  requestId?: string;
}

// Sayfalama tipi
interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Sayfalama parametreleri
interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filter?: Record<string, any>;
}

// Genel sorgu filtreleri
interface QueryFilters {
  [key: string]: any;
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  status?: string;
  type?: string;
  category?: string;
  tags?: string[];
}
