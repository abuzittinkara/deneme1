/**
 * tests/integration/api/api.test.ts
 * API entegrasyon testleri
 */
import request from 'supertest';
import mongoose from 'mongoose';
// Test için app'i import et
import app from '../../../src/app';

describe('API Integration Tests', () => {
  let server;
  let agent;

  beforeAll(async () => {
    // Test ortamını ayarla
    process.env.NODE_ENV = 'development';

    // Test sunucusunu başlat
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        // SuperTest agent oluştur
        agent = request.agent(server);
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Test ortamını temizle
    process.env.NODE_ENV = 'test';

    // Test sunucusunu kapat
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('API Health Check', () => {
    it('should return 200 OK for health check endpoint', async () => {
      const response = await agent
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('API Documentation', () => {
    it('should return 200 OK for API documentation', async () => {
      const response = await agent
        .get('/api-docs')
        .expect(200);

      // HTML yanıtı bekliyoruz
      expect(response.text).toContain('Swagger UI');
    });
  });

  describe('API Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await agent
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should return 405 for method not allowed', async () => {
      const response = await agent
        .put('/api/health') // PUT method is not allowed for health endpoint
        .expect(405);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'METHOD_NOT_ALLOWED');
    });
  });

  describe('API Authentication', () => {
    it('should return 401 for protected endpoints without token', async () => {
      const response = await agent
        .get('/api/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'AUTH_TOKEN_MISSING');
    });

    it('should return 401 for invalid token', async () => {
      const response = await agent
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should access protected endpoint with test token in development mode', async () => {
      const response = await agent
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-access-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('username', 'test');
    });
  });

  describe('API Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await agent
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('API CORS', () => {
    it('should include CORS headers', async () => {
      const response = await agent
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('API Security Headers', () => {
    it('should include security headers', async () => {
      const response = await agent
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });
});
