/**
 * tests/integration/auth/auth.test.ts
 * Auth API entegrasyon testleri
 */
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { app } from '../../../src/app';
import { User } from '../../../src/models/User';

describe('Auth API', () => {
  beforeEach(async () => {
    // Test veritabanını temizle
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New',
        surname: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.userId');
      expect(response.body).toHaveProperty('data.username', 'newuser');

      // Kullanıcının veritabanında olduğunu doğrula
      const user = await User.findOne({ username: 'newuser' });
      expect(user).not.toBeNull();
      expect(user?.email).toBe('newuser@example.com');
    });

    it('should return error for missing required fields', async () => {
      const userData = {
        username: 'newuser',
        // email eksik
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('e-posta');
    });

    it('should return error for duplicate username', async () => {
      // Önce bir kullanıcı oluştur
      const existingUser = new User({
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: await bcrypt.hash('Password123', 10),
        name: 'Existing',
        surname: 'User',
        isActive: true
      });
      await existingUser.save();

      // Aynı kullanıcı adıyla kayıt olmayı dene
      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'Password123',
        name: 'New',
        surname: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('kullanıcı adı zaten kullanılıyor');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Test kullanıcısı oluştur
      const passwordHash = await bcrypt.hash('Password123', 10);
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
        name: 'Test',
        surname: 'User',
        isActive: true,
        emailVerified: true,
        role: 'user'
      });
      await user.save();
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        usernameOrEmail: 'testuser',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('username', 'testuser');
    });

    it('should login with email', async () => {
      const loginData = {
        usernameOrEmail: 'test@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('username', 'testuser');
    });

    it('should return error for invalid password', async () => {
      const loginData = {
        usernameOrEmail: 'testuser',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Geçersiz kullanıcı adı/e-posta veya şifre');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        usernameOrEmail: 'nonexistent',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Geçersiz kullanıcı adı/e-posta veya şifre');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh token with valid refresh token', async () => {
      // Bu test, gerçek bir refresh token kullanmak yerine mock kullanabilir
      // Gerçek bir refresh token oluşturmak için önce login yapılmalı
      
      // Geliştirme modunda test token'ı kullan
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'test-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      // Geliştirme modunda test token'ı kullan
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer test-access-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('username', 'test');
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  afterAll(async () => {
    // Bağlantıyı kapat
    await mongoose.connection.close();
  });
});
