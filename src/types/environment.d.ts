/**
 * src/types/environment.d.ts
 * Çevre değişkenleri için tip tanımlamaları
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Uygulama
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      API_VERSION: string;

      // MongoDB
      MONGODB_URI: string;

      // Redis
      REDIS_HOST: string;
      REDIS_PORT: string;
      REDIS_PASSWORD?: string;
      REDIS_DB: string;

      // JWT
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      JWT_REFRESH_SECRET: string;
      JWT_REFRESH_EXPIRES_IN: string;

      // CORS
      CORS_ORIGIN: string;

      // Dosya yükleme
      UPLOAD_DIR: string;
      MAX_FILE_SIZE: string;

      // E-posta
      SMTP_HOST: string;
      SMTP_PORT: string;
      SMTP_USER: string;
      SMTP_PASS: string;
      SMTP_FROM: string;

      // Güvenlik
      RATE_LIMIT_WINDOW_MS: string;
      RATE_LIMIT_MAX: string;

      // Loglama
      LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';

      // Webhook
      WEBHOOK_SECRET: string;
    }
  }
}
