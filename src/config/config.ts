/**
 * src/config/config.ts
 * Uygulama yapılandırması
 */
import { env } from './env';

// Uygulama yapılandırması
export const config = {
  // Uygulama ayarları
  NODE_ENV: env.NODE_ENV,
  PORT: parseInt(env.PORT),

  // MongoDB ayarları
  MONGODB_URI: env.MONGODB_URI,
  MONGODB_USER: env.MONGODB_USER,
  MONGODB_PASSWORD: env.MONGODB_PASSWORD,
  MONGODB_HOST: env.MONGODB_HOST,
  MONGODB_DATABASE: env.MONGODB_DATABASE,

  // JWT ayarları
  JWT_SECRET: env.JWT_SECRET,
  JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN, // Doğru değişken adı

  // E-posta ayarları
  EMAIL_HOST: env.EMAIL_HOST,
  EMAIL_PORT: env.EMAIL_PORT,
  EMAIL_SECURE: env.EMAIL_SECURE,
  EMAIL_USER: env.EMAIL_USER,
  EMAIL_PASSWORD: env.EMAIL_PASSWORD,
  EMAIL_FROM_NAME: env.EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,

  // Uygulama URL'leri
  CLIENT_URL: env.CLIENT_URL,
  API_URL: env.API_URL,

  // Redis ayarları
  REDIS_HOST: env.REDIS_HOST,
  REDIS_PORT: parseInt(env.REDIS_PORT),
  REDIS_PASSWORD: env.REDIS_PASSWORD,
  REDIS_DB: parseInt(env.REDIS_DB),

  // CORS ayarları
  CORS_ORIGIN: env.CORS_ORIGIN,

  // Sentry ayarları
  SENTRY_DSN: env.SENTRY_DSN,

  // Mediasoup ayarları
  ANNOUNCED_IP: env.ANNOUNCED_IP,
  TURN_USERNAME: env.TURN_USERNAME,
  TURN_CREDENTIAL: env.TURN_CREDENTIAL,

  // Paket bilgileri
  VERSION: env.npm_package_version,

  // Yardımcı fonksiyonlar
  isDevelopment: env.isDevelopment,
  isProduction: env.isProduction,
  isTest: env.isTest,
};

export default config;
