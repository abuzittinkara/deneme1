/**
 * src/config/env.ts
 * Çevresel değişkenlere güvenli erişim sağlayan yardımcı modül
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env dosyasını yükle
const envFile = process.env.NODE_ENV === 'test'
  ? '.env.test'
  : process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env';

const envPath = path.resolve(process.cwd(), envFile);

// .env dosyası varsa yükle
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`${envPath} dosyası yüklendi`);
} else {
  // Varsayılan .env dosyasını yükle
  dotenv.config();
  console.log('Varsayılan .env dosyası yüklendi');
}

/**
 * Ortam değişkeni doğrulama fonksiyonu
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @param required - Zorunlu mu
 * @returns Ortam değişkeni değeri
 */
function getEnvVar(key: string, defaultValue?: string, required = false): string {
  const value = process.env[key] || defaultValue;

  if (required && !value) {
    const errorMessage = `${key} ortam değişkeni gereklidir`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return value || '';
}

/**
 * Ortam değişkeni doğrulama fonksiyonu (sayısal değerler için)
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @param required - Zorunlu mu
 * @returns Ortam değişkeni değeri (sayı)
 */
function getEnvVarAsNumber(key: string, defaultValue?: number, required = false): number {
  const stringValue = getEnvVar(key, defaultValue?.toString(), required);
  const numberValue = Number(stringValue);

  if (isNaN(numberValue)) {
    const errorMessage = `${key} ortam değişkeni geçerli bir sayı değil: ${stringValue}`;
    logger.error(errorMessage);
    return defaultValue || 0;
  }

  return numberValue;
}

/**
 * Ortam değişkeni doğrulama fonksiyonu (boolean değerler için)
 * @param key - Ortam değişkeni anahtarı
 * @param defaultValue - Varsayılan değer
 * @returns Ortam değişkeni değeri (boolean)
 */
function getEnvVarAsBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
}

// Çevresel değişkenleri tiplendirilmiş olarak dışa aktar
export const env = {
  // Uygulama ayarları
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: getEnvVar('PORT', '9092'),
  HOST: getEnvVar('HOST', '0.0.0.0'),
  APP_NAME: getEnvVar('APP_NAME', 'Fisqos API'),
  APP_VERSION: getEnvVar('APP_VERSION', '1.0.0'),
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),

  // MongoDB ayarları
  MONGODB_URI: getEnvVar('MONGODB_URI', '', process.env.NODE_ENV === 'production'),
  MONGODB_USER: getEnvVar('MONGODB_USER'),
  MONGODB_PASSWORD: getEnvVar('MONGODB_PASSWORD'),
  MONGODB_HOST: getEnvVar('MONGODB_HOST'),
  MONGODB_DATABASE: getEnvVar('MONGODB_DATABASE'),
  MONGODB_AUTH_SOURCE: getEnvVar('MONGODB_AUTH_SOURCE', 'admin'),
  MONGODB_SSL: getEnvVar('MONGODB_SSL', 'false'),
  MONGODB_RETRY_WRITES: getEnvVarAsBoolean('MONGODB_RETRY_WRITES', true),
  MONGODB_MAX_POOL_SIZE: getEnvVarAsNumber('MONGODB_MAX_POOL_SIZE', process.env.NODE_ENV === 'production' ? 20 : 10),
  MONGODB_MIN_POOL_SIZE: getEnvVarAsNumber('MONGODB_MIN_POOL_SIZE', process.env.NODE_ENV === 'production' ? 5 : 2),

  // JWT ayarları
  JWT_SECRET: getEnvVar('JWT_SECRET', process.env.NODE_ENV === 'production' ? '' : 'dev-jwt-secret', process.env.NODE_ENV === 'production'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '15m'), // Güvenlik için 15 dakika
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET', process.env.NODE_ENV === 'production' ? '' : 'dev-jwt-refresh-secret', process.env.NODE_ENV === 'production'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
  JWT_ALGORITHM: getEnvVar('JWT_ALGORITHM', 'HS256'),
  JWT_ISSUER: getEnvVar('JWT_ISSUER', 'fisqos-api'),
  JWT_AUDIENCE: getEnvVar('JWT_AUDIENCE', 'fisqos-client'),

  // E-posta ayarları
  EMAIL_HOST: getEnvVar('EMAIL_HOST', 'smtp.gmail.com'),
  EMAIL_PORT: getEnvVarAsNumber('EMAIL_PORT', 587),
  EMAIL_SECURE: getEnvVarAsBoolean('EMAIL_SECURE', false),
  EMAIL_USER: getEnvVar('EMAIL_USER', '', process.env.NODE_ENV === 'production'),
  EMAIL_PASSWORD: getEnvVar('EMAIL_PASSWORD', '', process.env.NODE_ENV === 'production'),
  EMAIL_FROM_NAME: getEnvVar('EMAIL_FROM_NAME', 'Fisqos'),
  EMAIL_FROM_ADDRESS: getEnvVar('EMAIL_FROM_ADDRESS', 'noreply@fisqos.com'),
  EMAIL_TEMPLATE_DIR: getEnvVar('EMAIL_TEMPLATE_DIR', 'src/templates/email'),

  // Uygulama URL'leri
  CLIENT_URL: getEnvVar('CLIENT_URL', 'http://localhost:9092'),
  API_URL: getEnvVar('API_URL', 'http://localhost:9092'),
  SOCKET_URL: getEnvVar('SOCKET_URL', 'http://localhost:9092'),
  ADMIN_URL: getEnvVar('ADMIN_URL', 'http://localhost:9092/admin'),

  // Redis ayarları
  REDIS_ENABLED: getEnvVar('REDIS_ENABLED', process.env.NODE_ENV === 'production' ? 'true' : 'false'),
  REDIS_HOST: getEnvVar('REDIS_HOST', 'localhost'),
  REDIS_PORT: getEnvVar('REDIS_PORT', '6379'),
  REDIS_PASSWORD: getEnvVar('REDIS_PASSWORD'),
  REDIS_DB: getEnvVar('REDIS_DB', '0'),
  REDIS_PREFIX: getEnvVar('REDIS_PREFIX', 'fisqos:'),
  REDIS_TTL: getEnvVarAsNumber('REDIS_TTL', 3600), // 1 saat

  // CORS ayarları
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', '*'),
  CORS_METHODS: getEnvVar('CORS_METHODS', 'GET,POST,PUT,DELETE,OPTIONS'),
  CORS_ALLOWED_HEADERS: getEnvVar('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization,X-Requested-With'),
  CORS_EXPOSED_HEADERS: getEnvVar('CORS_EXPOSED_HEADERS', 'Content-Range,X-Total-Count'),
  CORS_CREDENTIALS: getEnvVarAsBoolean('CORS_CREDENTIALS', true),
  CORS_MAX_AGE: getEnvVarAsNumber('CORS_MAX_AGE', 86400), // 24 saat

  // Sentry ayarları
  SENTRY_DSN: getEnvVar('SENTRY_DSN'),
  SENTRY_ENVIRONMENT: getEnvVar('SENTRY_ENVIRONMENT', process.env.NODE_ENV || 'development'),
  SENTRY_RELEASE: getEnvVar('SENTRY_RELEASE', 'v1.0.0'),
  SENTRY_TRACES_SAMPLE_RATE: getEnvVarAsNumber('SENTRY_TRACES_SAMPLE_RATE', 0.1), // %10

  // Mediasoup ayarları
  ANNOUNCED_IP: getEnvVar('ANNOUNCED_IP', 'localhost'),
  TURN_USERNAME: getEnvVar('TURN_USERNAME', process.env.NODE_ENV === 'production' ? '' : 'dev-turn-user', process.env.NODE_ENV === 'production'),
  TURN_CREDENTIAL: getEnvVar('TURN_CREDENTIAL', process.env.NODE_ENV === 'production' ? '' : 'dev-turn-credential', process.env.NODE_ENV === 'production'),

  // Socket.IO ayarları
  SOCKET_ADMIN_UI_ENABLED: getEnvVar('SOCKET_ADMIN_UI_ENABLED', process.env.NODE_ENV === 'production' ? 'false' : 'true'),
  SOCKET_ADMIN_UI_USERNAME: getEnvVar('SOCKET_ADMIN_UI_USERNAME', 'admin'),
  SOCKET_ADMIN_UI_PASSWORD: getEnvVar('SOCKET_ADMIN_UI_PASSWORD', 'admin'),
  SKIP_SOCKET_AUTH: getEnvVar('SKIP_SOCKET_AUTH', process.env.NODE_ENV === 'production' ? 'false' : 'true'),

  // Dosya yükleme ayarları
  UPLOAD_DIR: getEnvVar('UPLOAD_DIR', 'uploads'),
  TEMP_UPLOAD_DIR: getEnvVar('TEMP_UPLOAD_DIR', 'uploads/temp'),
  MAX_FILE_SIZE: getEnvVarAsNumber('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
  ALLOWED_FILE_TYPES: getEnvVar('ALLOWED_FILE_TYPES', 'image,document,audio,video'),
  REQUIRE_AUTH_FOR_UPLOADS: getEnvVar('REQUIRE_AUTH_FOR_UPLOADS', process.env.NODE_ENV === 'production' ? 'true' : 'false'),

  // Güvenlik ayarları
  RATE_LIMIT_WINDOW_MS: getEnvVarAsNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 dakika
  RATE_LIMIT_MAX: getEnvVarAsNumber('RATE_LIMIT_MAX', 100), // 15 dakikada 100 istek
  ALLOWED_HOSTS: getEnvVar('ALLOWED_HOSTS', ''),
  BCRYPT_SALT_ROUNDS: getEnvVarAsNumber('BCRYPT_SALT_ROUNDS', 12),

  // i18n ayarları
  DEFAULT_LANGUAGE: getEnvVar('DEFAULT_LANGUAGE', 'tr'),
  SUPPORTED_LANGUAGES: getEnvVar('SUPPORTED_LANGUAGES', 'tr,en'),

  // Paket bilgileri
  npm_package_version: getEnvVar('npm_package_version', '1.0.0'),

  // Yardımcı fonksiyonlar ve özellikler
  isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',
  isProduction: getEnvVar('NODE_ENV') === 'production',
  isTest: getEnvVar('NODE_ENV') === 'test',

  // Özellik bayrakları
  FEATURE_SOCKET_IO: getEnvVarAsBoolean('FEATURE_SOCKET_IO', true),
  FEATURE_EMAIL: getEnvVarAsBoolean('FEATURE_EMAIL', process.env.NODE_ENV === 'production'),
  FEATURE_SENTRY: getEnvVarAsBoolean('FEATURE_SENTRY', process.env.NODE_ENV === 'production'),
  FEATURE_REDIS: getEnvVarAsBoolean('FEATURE_REDIS', process.env.NODE_ENV === 'production'),
  FEATURE_RATE_LIMIT: getEnvVarAsBoolean('FEATURE_RATE_LIMIT', true),
  FEATURE_SWAGGER: getEnvVarAsBoolean('FEATURE_SWAGGER', true),
  FEATURE_COMPRESSION: getEnvVarAsBoolean('FEATURE_COMPRESSION', true),
  FEATURE_HELMET: getEnvVarAsBoolean('FEATURE_HELMET', true),
  FEATURE_CORS: getEnvVarAsBoolean('FEATURE_CORS', true),
  FEATURE_MORGAN: getEnvVarAsBoolean('FEATURE_MORGAN', true),
};

// Üretim ortamında gerekli çevre değişkenlerini kontrol et
if (env.isProduction) {
  // Gerekli ortam değişkenleri zaten getEnvVar fonksiyonu içinde kontrol ediliyor
  // Bu nedenle burada ek bir kontrol yapmaya gerek yok

  // Ortam değişkenlerinin durumunu logla
  console.log('Ortam değişkenleri yüklendi', {
    environment: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    mongodbConnected: !!env.MONGODB_URI,
    jwtConfigured: !!env.JWT_SECRET && !!env.JWT_REFRESH_SECRET,
    emailConfigured: !!env.EMAIL_USER && !!env.EMAIL_PASSWORD,
    sentryConfigured: !!env.SENTRY_DSN,
    redisEnabled: env.REDIS_ENABLED === 'true',
    features: {
      socketIO: env.FEATURE_SOCKET_IO,
      email: env.FEATURE_EMAIL,
      sentry: env.FEATURE_SENTRY,
      redis: env.FEATURE_REDIS,
      rateLimit: env.FEATURE_RATE_LIMIT,
      swagger: env.FEATURE_SWAGGER,
      compression: env.FEATURE_COMPRESSION,
      helmet: env.FEATURE_HELMET,
      cors: env.FEATURE_CORS,
      morgan: env.FEATURE_MORGAN
    }
  });
} else {
  // Geliştirme ortamında ortam değişkenlerinin durumunu logla
  console.log('Geliştirme ortamı değişkenleri yüklendi', {
    environment: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    mongodbUri: env.MONGODB_URI || 'localhost:27017',
    redisEnabled: env.REDIS_ENABLED === 'true'
  });
}

export default env;
