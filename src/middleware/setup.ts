/**
 * src/middleware/setup.ts
 * Middleware kurulum yardımcısı
 */
import express, { Application } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requestLogger, logger } from '../utils/logger';
import { setupSecurityMiddleware } from './security';
import { apiLimiter, authLimiter } from './rateLimit';
import sentryHandler from './sentryHandler';

/**
 * Express uygulaması için middleware'leri ayarlar
 * @param app - Express uygulaması
 */
export function setupMiddleware(app: Application): void {
  // Sentry'yi yapılandır ve başlat
  sentryHandler.setupSentry(app);

  // İstek ID middleware'i
  app.use((req, _res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
    next();
  });

  // Sentry istek işleme middleware'i
  app.use(sentryHandler.sentryRequestHandler);
  app.use(sentryHandler.sentryTracingHandler);

  // Loglama middleware'i
  app.use(requestLogger);

  // Statik dosyalar - güvenli yollar kullanarak
  const publicPath = path.resolve(path.join(__dirname, '../../public'));
  const uploadsPath = path.resolve(path.join(__dirname, '../../uploads'));

  // Yolların varlığını kontrol et
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  } else {
    logger.warn('Public dizini bulunamadı', { path: publicPath });
  }

  // Uploads dizini için güvenlik kontrolü
  if (fs.existsSync(uploadsPath)) {
    app.use(
      '/uploads',
      (req, res, next) => {
        // Yol geçişi saldırılarına karşı kontrol et
        if (req.path.includes('..') || req.path.includes('~')) {
          return res.status(403).send('Geçersiz dosya yolu');
        }
        next();
      },
      express.static(uploadsPath)
    );
  } else {
    logger.warn('Uploads dizini bulunamadı', { path: uploadsPath });
  }

  // Body parsing middleware'leri
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Güvenlik middleware'leri
  setupSecurityMiddleware(app);

  // Rate limiting middleware'leri
  app.use('/api/', apiLimiter as any);
  app.use('/api/auth/', authLimiter as any);

  // Sentry kullanıcı bağlamı middleware'i
  app.use(sentryHandler.sentryUserContext);
}
