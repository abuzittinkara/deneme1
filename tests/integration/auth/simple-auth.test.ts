/**
 * tests/integration/auth/simple-auth.test.ts
 * Basitleştirilmiş kimlik doğrulama entegrasyon testi
 */
import request from 'supertest';
import { app } from '../../../src/app';
import { User } from '../../../src/models/User';
import mongoose from 'mongoose';

describe('Auth API', () => {
  // Test kullanıcısı
  const testUser = {
    email: 'test@example.com',
    password: 'Password123!',
    username: 'testuser',
    name: 'Test User'
  };
  
  // Test öncesi kullanıcıyı temizle
  beforeAll(async () => {
    await User.deleteMany({ email: testUser.email });
  });
  
  // Test sonrası kullanıcıyı temizle
  afterAll(async () => {
    await User.deleteMany({ email: testUser.email });
  });
  
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('başarıyla kaydedildi');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user.username).toBe(testUser.username);
    expect(response.body.data.user).not.toHaveProperty('password');
    expect(response.body.data).toHaveProperty('tokens');
    expect(response.body.data.tokens).toHaveProperty('accessToken');
    expect(response.body.data.tokens).toHaveProperty('refreshToken');
  });
  
  it('should login an existing user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('başarıyla giriş yaptı');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user).not.toHaveProperty('password');
    expect(response.body.data).toHaveProperty('tokens');
    expect(response.body.data.tokens).toHaveProperty('accessToken');
    expect(response.body.data.tokens).toHaveProperty('refreshToken');
  });
  
  it('should reject login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123!'
      });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('geçersiz');
  });
});
