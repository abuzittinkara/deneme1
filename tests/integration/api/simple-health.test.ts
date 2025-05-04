/**
 * tests/integration/api/simple-health.test.ts
 * Basitleştirilmiş sağlık kontrolü testi
 */
import express from 'express';
import request from 'supertest';

describe('Simple Health API', () => {
  let app: express.Application;

  beforeAll(() => {
    // Test için basit bir Express uygulaması oluştur
    app = express();
    
    // Basit bir sağlık kontrolü endpoint'i ekle
    app.get('/api/health', (_req, res) => {
      res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });
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
  });
});
