/**
 * src/routes/setup.ts
 * Route kurulum yardımcısı
 */
import { Application, Express } from 'express';
import healthRoutes from './health';
import apiRoutes from './api';
import { setupSwagger } from '../config/swagger';
import { notFoundHandler, errorHandler } from '../middleware/errorHandler';
import sentryHandler from '../middleware/sentryHandler';

/**
 * Express uygulaması için rotaları ayarlar
 * @param app - Express uygulaması
 */
export function setupRoutes(app: Application): void {
  // Swagger API dokümantasyonunu ekle
  setupSwagger(app as Express);

  // Sağlık kontrolü rotaları
  app.use(healthRoutes);

  // API rotalarını ekle
  app.use('/api', apiRoutes);

  // 404 hatası için middleware
  app.use(notFoundHandler);

  // Sentry hata işleyici middleware
  app.use(sentryHandler.sentryErrorHandler);

  // Hata işleyici middleware
  app.use(errorHandler);
}
