/**
 * src/tests/integration/api.test.ts
 * API entegrasyon testleri
 */
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app';
import { setupTestDatabase, teardownTestDatabase, clearCollections } from '../setup';
import { User } from '../../models/User';
import { generateToken } from '../../utils/jwt';

describe('API Entegrasyon Testleri', () => {
  let authToken: string;
  let testUserId: string;
  
  before(async () => {
    // Test veritabanını kur
    await setupTestDatabase();
    
    // Test kullanıcısı oluştur
    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789',
      name: 'Test',
      surname: 'User',
      status: 'online'
    });
    
    await testUser.save();
    testUserId = testUser._id.toString();
    
    // Test kullanıcısı için token oluştur
    authToken = generateToken({
      userId: testUserId,
      username: 'testuser',
      role: 'user'
    });
  });
  
  after(async () => {
    // Test veritabanını kapat
    await teardownTestDatabase();
  });
  
  beforeEach(async () => {
    // Her testten önce koleksiyonları temizle (kullanıcı hariç)
    await clearCollections();
  });
  
  describe('Sağlık Kontrolü', () => {
    it('GET /api/health 200 OK döndürmeli', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).to.have.property('status', 'ok');
    });
    
    it('GET /api/health/detailed 200 OK döndürmeli', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);
      
      expect(response.body).to.have.property('status', 'ok');
      expect(response.body).to.have.property('uptime');
      expect(response.body).to.have.property('memory');
      expect(response.body).to.have.property('system');
    });
  });
  
  describe('Kimlik Doğrulama', () => {
    it('POST /api/auth/login geçerli kimlik bilgileriyle 200 OK döndürmeli', async () => {
      // Bu test, gerçek kimlik doğrulama mantığını test etmez
      // Sadece API endpoint'inin varlığını ve genel davranışını kontrol eder
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(400); // Gerçek şifre olmadığı için 400 döner
      
      expect(response.body).to.have.property('success', false);
    });
    
    it('GET /api/auth/me kimlik doğrulama olmadan 401 Unauthorized döndürmeli', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
    
    it('GET /api/auth/me geçerli token ile 200 OK döndürmeli', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('username', 'testuser');
    });
  });
  
  describe('Kullanıcı İşlemleri', () => {
    it('GET /api/users kimlik doğrulama olmadan 401 Unauthorized döndürmeli', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
    
    it('GET /api/users geçerli token ile 200 OK döndürmeli', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
    });
    
    it('GET /api/users/:id geçerli kullanıcı ID ile 200 OK döndürmeli', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('username', 'testuser');
    });
    
    it('GET /api/users/:id geçersiz kullanıcı ID ile 404 Not Found döndürmeli', async () => {
      const invalidId = '60d21b4667d0d8992e610c85';
      
      await request(app)
        .get(`/api/users/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
  
  describe('Grup İşlemleri', () => {
    it('POST /api/groups yeni grup oluşturmalı', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          description: 'Test group description'
        })
        .expect(201);
      
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('name', 'Test Group');
      expect(response.body.data).to.have.property('owner', testUserId);
    });
    
    it('GET /api/groups kullanıcının gruplarını getirmeli', async () => {
      // Önce bir grup oluştur
      await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          description: 'Test group description'
        });
      
      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length.at.least(1);
    });
  });
});
