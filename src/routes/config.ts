/**
 * src/routes/config.ts
 * Uygulama yapılandırma yönetimi rotaları
 */
import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

// Router oluştur
const router = express.Router();

/**
 * Uygulama yapılandırmasını getirir
 */
router.get('/api/config', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    // Hassas bilgileri filtrele
    const safeConfig = {
      app: {
        name: env.APP_NAME,
        version: env.APP_VERSION,
        environment: env.NODE_ENV,
        port: env.PORT,
        host: env.HOST,
      },
      database: {
        connected: true, // Varsayılan olarak bağlı kabul ediyoruz
        host: env.MONGODB_HOST ? env.MONGODB_HOST.split('@').pop() : 'localhost',
        database: env.MONGODB_DATABASE || 'fisqos_dev',
        ssl: env.MONGODB_SSL === 'true',
      },
      redis: {
        enabled: env.REDIS_ENABLED === 'true',
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
      },
      email: {
        enabled: env.FEATURE_EMAIL,
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_SECURE,
        fromName: env.EMAIL_FROM_NAME,
        fromAddress: env.EMAIL_FROM_ADDRESS,
      },
      cors: {
        enabled: env.FEATURE_CORS,
        origin: env.CORS_ORIGIN,
        methods: env.CORS_METHODS,
        credentials: env.CORS_CREDENTIALS,
      },
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
        morgan: env.FEATURE_MORGAN,
      },
      i18n: {
        defaultLanguage: env.DEFAULT_LANGUAGE,
        supportedLanguages: env.SUPPORTED_LANGUAGES.split(','),
      },
      uploads: {
        dir: env.UPLOAD_DIR,
        tempDir: env.TEMP_UPLOAD_DIR,
        maxFileSize: env.MAX_FILE_SIZE,
        allowedFileTypes: env.ALLOWED_FILE_TYPES.split(','),
        requireAuth: env.REQUIRE_AUTH_FOR_UPLOADS === 'true',
      },
    };

    res.json({
      success: true,
      data: safeConfig,
    });
  } catch (error) {
    logger.error('Yapılandırma bilgileri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Yapılandırma bilgileri alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

/**
 * Uygulama durumunu getirir
 */
router.get('/api/config/status', (req: Request, res: Response) => {
  try {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: env.APP_VERSION || env.npm_package_version,
      environment: env.NODE_ENV,
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Uygulama durumu alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Uygulama durumu alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

/**
 * Uygulama bilgilerini getirir
 */
router.get('/api/config/info', (req: Request, res: Response) => {
  try {
    // package.json dosyasını oku
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const info = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      license: packageJson.license,
      engines: packageJson.engines,
      dependencies: Object.keys(packageJson.dependencies).length,
      devDependencies: Object.keys(packageJson.devDependencies).length,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: process.uptime(),
    };

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    logger.error('Uygulama bilgileri alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Uygulama bilgileri alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

/**
 * Özellik bayraklarını getirir
 */
router.get('/api/config/features', (req: Request, res: Response) => {
  try {
    const features = {
      socketIO: env.FEATURE_SOCKET_IO,
      email: env.FEATURE_EMAIL,
      sentry: env.FEATURE_SENTRY,
      redis: env.FEATURE_REDIS,
      rateLimit: env.FEATURE_RATE_LIMIT,
      swagger: env.FEATURE_SWAGGER,
      compression: env.FEATURE_COMPRESSION,
      helmet: env.FEATURE_HELMET,
      cors: env.FEATURE_CORS,
      morgan: env.FEATURE_MORGAN,
    };

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    logger.error('Özellik bayrakları alınırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Özellik bayrakları alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
    });
  }
});

export default router;
