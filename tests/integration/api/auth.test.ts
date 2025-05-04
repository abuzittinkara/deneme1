/**
 * tests/integration/api/auth.test.ts
 * Auth API entegrasyon testi
 */
import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../../../src/routes/setup';
import { setupMiddleware } from '../../../src/middleware/setup';

describe('Auth API', () => {
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

  describe('Authentication', () => {
    it('should return 401 for protected endpoints without token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'AUTH_TOKEN_MISSING');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should access protected endpoint with test token in development mode', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-access-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('username', 'test');
    });
  });

  describe('Login', () => {
    it('should login with test credentials in development mode', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'test',
          password: 'Password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('username', 'test');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'test',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('Refresh Token', () => {
    it('should refresh token with test refresh token in development mode', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'test-refresh-token'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalid-refresh-token'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_REFRESH_TOKEN');
    });
  });
});
