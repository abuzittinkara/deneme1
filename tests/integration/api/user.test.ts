/**
 * tests/integration/api/user.test.ts
 * Kullanıcı API'si için entegrasyon testleri
 */
import request from 'supertest';
import { app } from '../../../src/app';
import { User } from '../../../src/models/User';
import mongoose from 'mongoose';

describe('User API', () => {
  // Test kullanıcısı
  const testUser = {
    email: 'user-test@example.com',
    password: 'Password123!',
    username: 'usertest',
    name: 'User Test'
  };
  
  // Kimlik doğrulama token'ları
  let accessToken: string;
  let userId: string;
  
  // Test öncesi kullanıcıyı oluştur ve giriş yap
  beforeAll(async () => {
    // Kullanıcıyı temizle
    await User.deleteMany({ email: testUser.email });
    
    // Kullanıcıyı kaydet
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    // Token'ları ve kullanıcı ID'sini al
    accessToken = registerResponse.body.data.tokens.accessToken;
    userId = registerResponse.body.data.user.id;
  });
  
  // Test sonrası kullanıcıyı temizle
  afterAll(async () => {
    await User.deleteMany({ email: testUser.email });
  });
  
  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.username).toBe(testUser.username);
      expect(response.body.data.user).not.toHaveProperty('password');
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/me');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/users/me', () => {
    it('should update user profile', async () => {
      const updatedData = {
        name: 'Updated Name',
        bio: 'This is my updated bio'
      };
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.name).toBe(updatedData.name);
      expect(response.body.data.user.bio).toBe(updatedData.bio);
      expect(response.body.data.user.email).toBe(testUser.email);
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ name: 'Test' });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should not update email or username', async () => {
      const updatedData = {
        email: 'newemail@example.com',
        username: 'newusername'
      };
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.username).toBe(testUser.username);
    });
  });
  
  describe('GET /api/users/:id', () => {
    it('should return user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });
    
    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app)
        .get(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      
      // Kullanıcı listesinde test kullanıcısı var mı?
      const foundUser = response.body.data.users.find((user: any) => user.id === userId);
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(testUser.email);
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/users');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/users?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('pages');
    });
    
    it('should support search by username', async () => {
      const response = await request(app)
        .get(`/api/users?search=${testUser.username}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      
      // Arama sonuçlarında test kullanıcısı var mı?
      const foundUser = response.body.data.users.find((user: any) => user.id === userId);
      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(testUser.username);
    });
  });
});
