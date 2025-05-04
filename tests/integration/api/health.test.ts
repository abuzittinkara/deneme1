/**
 * tests/integration/api/health.test.ts
 * API sağlık kontrolü entegrasyon testi
 */
import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../../../src/routes/setup';
import { setupMiddleware } from '../../../src/middleware/setup';

describe('Health API', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Test ortamını ayarla
    process.env.NODE_ENV = 'development';

    // Test için Express uygulaması oluştur
    app = express();
    
    // Middleware ve route'ları ayarla
    setupMiddleware(app);
    setupRoutes(app);

    // Test sunucusunu başlat
    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Test ortamını temizle
    process.env.NODE_ENV = 'test';

    // Test sunucusunu kapat
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with API status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should return 405 for method not allowed', async () => {
      const response = await request(app)
        .put('/api/health') // PUT method is not allowed for health endpoint
        .expect(405);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'METHOD_NOT_ALLOWED');
    });
  });
});
