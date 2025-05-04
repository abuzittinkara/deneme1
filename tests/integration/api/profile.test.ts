/**
 * tests/integration/api/profile.test.ts
 * Profil API'si için entegrasyon testleri
 */
import request from 'supertest';
import { app } from '../../../src/app';
import { User } from '../../../src/models/User';
import mongoose from 'mongoose';

describe('Profile API', () => {
  // Test kullanıcısı
  const testUser = {
    email: 'profile-test@example.com',
    password: 'Password123!',
    username: 'profiletest',
    name: 'Profile Test'
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
  
  describe('GET /api/profile', () => {
    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data.profile.email).toBe(testUser.email);
      expect(response.body.data.profile.username).toBe(testUser.username);
      expect(response.body.data.profile).not.toHaveProperty('password');
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/profile', () => {
    it('should update user profile', async () => {
      const updatedData = {
        name: 'Updated Profile Name',
        bio: 'This is my updated profile bio',
        location: 'Istanbul, Turkey',
        website: 'https://example.com'
      };
      
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data.profile.name).toBe(updatedData.name);
      expect(response.body.data.profile.bio).toBe(updatedData.bio);
      expect(response.body.data.profile.location).toBe(updatedData.location);
      expect(response.body.data.profile.website).toBe(updatedData.website);
      expect(response.body.data.profile.email).toBe(testUser.email);
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .put('/api/profile')
        .send({ name: 'Test' });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should validate website URL', async () => {
      const updatedData = {
        website: 'invalid-url'
      };
      
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('website');
    });
  });
  
  describe('GET /api/profile/:username', () => {
    it('should return profile by username', async () => {
      const response = await request(app)
        .get(`/api/profile/${testUser.username}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data.profile.username).toBe(testUser.username);
      expect(response.body.data.profile.email).toBe(testUser.email);
      expect(response.body.data.profile).not.toHaveProperty('password');
    });
    
    it('should return 404 for non-existent username', async () => {
      const response = await request(app)
        .get('/api/profile/nonexistentuser')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/api/profile/${testUser.username}`);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/profile/password', () => {
    it('should update user password', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      };
      
      const response = await request(app)
        .put('/api/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('şifre');
      
      // Yeni şifre ile giriş yapabilmeli
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: passwordData.newPassword
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      
      // Şifreyi eski haline getir
      await request(app)
        .put('/api/profile/password')
        .set('Authorization', `Bearer ${loginResponse.body.data.tokens.accessToken}`)
        .send({
          currentPassword: passwordData.newPassword,
          newPassword: testUser.password,
          confirmPassword: testUser.password
        });
    });
    
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .put('/api/profile/password')
        .send({
          currentPassword: 'test',
          newPassword: 'test123',
          confirmPassword: 'test123'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should validate password strength', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'weak',
        confirmPassword: 'weak'
      };
      
      const response = await request(app)
        .put('/api/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('şifre');
    });
    
    it('should validate password confirmation', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'StrongPassword123!',
        confirmPassword: 'DifferentPassword123!'
      };
      
      const response = await request(app)
        .put('/api/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('eşleşmiyor');
    });
  });
});
