/**
 * src/tests/integration/auth.test.ts
 * Kimlik doğrulama entegrasyon testleri
 */
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app';
import { setupTestDatabase, teardownTestDatabase, clearCollections } from '../setup';
import { User } from '../../models/User';
import bcrypt from 'bcrypt';

describe('Kimlik Doğrulama API Testleri', () => {
  before(async () => {
    // Test veritabanını kur
    await setupTestDatabase();

    // Test kullanıcısı oluştur
    const passwordHash = await bcrypt.hash('password123', 10);

    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash,
      name: 'Test',
      surname: 'User',
      status: 'online',
    });

    await testUser.save();
  });

  after(async () => {
    // Test veritabanını kapat
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // Her testten önce koleksiyonları temizle (kullanıcı hariç)
    await clearCollections();
  });

  describe('Kullanıcı Kaydı', () => {
    it('POST /api/auth/register geçerli verilerle yeni kullanıcı oluşturmalı', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New',
          surname: 'User',
        })
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('username', 'newuser');
      expect(response.body.data).to.have.property('email', 'newuser@example.com');
      expect(response.body.data).to.not.have.property('passwordHash');
    });

    it('POST /api/auth/register mevcut kullanıcı adıyla 409 Conflict döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser', // Mevcut kullanıcı adı
          email: 'another@example.com',
          password: 'password123',
          name: 'Another',
          surname: 'User',
        })
        .expect(409);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('message').that.includes('kullanıcı adı');
    });

    it('POST /api/auth/register eksik verilerle 400 Bad Request döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'incomplete',
          // email eksik
          password: 'password123',
          // name ve surname eksik
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Kullanıcı Girişi', () => {
    it('POST /api/auth/login geçerli kimlik bilgileriyle token döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('refreshToken');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data.user).to.have.property('username', 'testuser');
    });

    it('POST /api/auth/login geçersiz kullanıcı adıyla 401 Unauthorized döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });

    it('POST /api/auth/login geçersiz şifreyle 401 Unauthorized döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Token Yenileme', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Önce giriş yap ve refresh token al
      const loginResponse = await request(app).post('/api/auth/login').send({
        username: 'testuser',
        password: 'password123',
      });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('POST /api/auth/refresh geçerli refresh token ile yeni token döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('refreshToken');
    });

    it('POST /api/auth/refresh geçersiz refresh token ile 401 Unauthorized döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Şifre Sıfırlama', () => {
    it('POST /api/auth/forgot-password geçerli e-posta ile 200 OK döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('message').that.includes('gönderildi');
    });

    it('POST /api/auth/forgot-password geçersiz e-posta ile 404 Not Found döndürmeli', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(404);

      expect(response.body).to.have.property('success', false);
    });
  });
});
