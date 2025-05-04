/**
 * src/middleware/setup.ts
 * Middleware kurulum yardımcısı
 */
import express, { Application } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requestLogger } from '../utils/logger';
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

  // Statik dosyalar
  app.use(express.static(path.join(__dirname, '../../public')));
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
  
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
