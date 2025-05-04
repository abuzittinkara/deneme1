/**
 * src/__tests__/integration/user.test.ts
 * Kullanıcı API entegrasyon testleri
 */
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { User } from '../../models/User';
import * as userManager from '../../modules/userManager';
import * as profileManager from '../../modules/profileManager';

// MongoDB bağlantısını mockla
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      ...actualMongoose.connection,
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn(),
          find: jest.fn(),
          insertOne: jest.fn(),
          updateOne: jest.fn(),
          deleteOne: jest.fn()
        })
      }
    }
  };
});

// Modülleri mockla
jest.mock('../../modules/userManager');
jest.mock('../../modules/profileManager');

describe('User API', () => {
  let authToken: string;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth token
    authToken = 'Bearer mock-token';
  });
  
  describe('GET /api/users/me', () => {
    it('should get current user profile successfully', async () => {
      // Mock getUserProfile fonksiyonu
      (userManager.getCurrentUser as jest.Mock).mockResolvedValue({
        _id: '123456789',
        username: 'testuser',
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        status: 'online',
        lastSeen: new Date(),
        profilePicture: 'picture-id'
      });
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', authToken)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        data: {
          _id: '123456789',
          username: 'testuser',
          name: 'Test',
          surname: 'User',
          email: 'test@example.com',
          status: 'online',
          lastSeen: expect.any(String),
          profilePicture: 'picture-id'
        }
      });
      
      expect(userManager.getCurrentUser).toHaveBeenCalled();
    });
    
    it('should return error for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect('Content-Type', /json/)
        .expect(401);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Kimlik doğrulama başarısız: Token bulunamadı',
        code: 'UNAUTHORIZED'
      });
      
      expect(userManager.getCurrentUser).not.toHaveBeenCalled();
    });
  });
  
  describe('GET /api/users/:username', () => {
    it('should get user profile by username successfully', async () => {
      // Mock getUserByUsername fonksiyonu
      (userManager.getUserByUsername as jest.Mock).mockResolvedValue({
        _id: '123456789',
        username: 'testuser',
        name: 'Test',
        surname: 'User',
        status: 'online',
        lastSeen: new Date(),
        profilePicture: 'picture-id'
      });
      
      const response = await request(app)
        .get('/api/users/testuser')
        .set('Authorization', authToken)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        data: {
          _id: '123456789',
          username: 'testuser',
          name: 'Test',
          surname: 'User',
          status: 'online',
          lastSeen: expect.any(String),
          profilePicture: 'picture-id'
        }
      });
      
      expect(userManager.getUserByUsername).toHaveBeenCalledWith('testuser');
    });
    
    it('should return error for non-existent user', async () => {
      // Mock getUserByUsername fonksiyonu
      (userManager.getUserByUsername as jest.Mock).mockRejectedValue(
        new Error('Kullanıcı bulunamadı')
      );
      
      const response = await request(app)
        .get('/api/users/nonexistent')
        .set('Authorization', authToken)
        .expect('Content-Type', /json/)
        .expect(404);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Kullanıcı bulunamadı',
        code: 'NOT_FOUND'
      });
      
      expect(userManager.getUserByUsername).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('PUT /api/users/me/profile', () => {
    it('should update user profile successfully', async () => {
      // Mock updateUserProfile fonksiyonu
      (profileManager.updateUserProfile as jest.Mock).mockResolvedValue({
        _id: '123456789',
        username: 'testuser',
        name: 'New Name',
        surname: 'New Surname',
        email: 'new@example.com',
        bio: 'New bio',
        customStatus: 'New status',
        preferences: {
          theme: 'light',
          notifications: false
        }
      });
      
      const profileData = {
        name: 'New Name',
        surname: 'New Surname',
        email: 'new@example.com',
        bio: 'New bio',
        customStatus: 'New status',
        preferences: {
          theme: 'light',
          notifications: false
        }
      };
      
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', authToken)
        .send(profileData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'Profil başarıyla güncellendi',
        data: {
          _id: '123456789',
          username: 'testuser',
          name: 'New Name',
          surname: 'New Surname',
          email: 'new@example.com',
          bio: 'New bio',
          customStatus: 'New status',
          preferences: {
            theme: 'light',
            notifications: false
          }
        }
      });
      
      expect(profileManager.updateUserProfile).toHaveBeenCalledWith(
        expect.any(String),
        profileData
      );
    });
    
    it('should return validation error for invalid data', async () => {
      const invalidData = {
        email: 'invalid-email'
      };
      
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', authToken)
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
        errors: expect.any(Array)
      });
      
      expect(profileManager.updateUserProfile).not.toHaveBeenCalled();
    });
  });
  
  describe('PUT /api/users/me/password', () => {
    it('should change password successfully', async () => {
      // Mock changeUserPassword fonksiyonu
      (profileManager.changeUserPassword as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Şifre başarıyla güncellendi'
      });
      
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };
      
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', authToken)
        .send(passwordData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'Şifre başarıyla güncellendi'
      });
      
      expect(profileManager.changeUserPassword).toHaveBeenCalledWith(
        expect.any(String),
        passwordData.currentPassword,
        passwordData.newPassword
      );
    });
    
    it('should return validation error for weak password', async () => {
      const weakPasswordData = {
        currentPassword: 'OldPassword123!',
        newPassword: '123' // Çok kısa
      };
      
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', authToken)
        .send(weakPasswordData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
        errors: expect.any(Array)
      });
      
      expect(profileManager.changeUserPassword).not.toHaveBeenCalled();
    });
    
    it('should return error for incorrect current password', async () => {
      // Mock changeUserPassword fonksiyonu
      (profileManager.changeUserPassword as jest.Mock).mockRejectedValue(
        new Error('Mevcut şifre hatalı')
      );
      
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!'
      };
      
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', authToken)
        .send(passwordData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Mevcut şifre hatalı',
        code: 'VALIDATION_ERROR'
      });
      
      expect(profileManager.changeUserPassword).toHaveBeenCalledWith(
        expect.any(String),
        passwordData.currentPassword,
        passwordData.newPassword
      );
    });
  });
  
  describe('PUT /api/users/me/status', () => {
    it('should update user status successfully', async () => {
      // Mock updateUserStatus fonksiyonu
      (userManager.updateUserStatus as jest.Mock).mockResolvedValue({
        success: true,
        status: 'away'
      });
      
      const statusData = {
        status: 'away'
      };
      
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', authToken)
        .send(statusData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'Durum güncellendi',
        data: {
          status: 'away'
        }
      });
      
      expect(userManager.updateUserStatus).toHaveBeenCalledWith(
        expect.any(String),
        statusData.status
      );
    });
    
    it('should return validation error for invalid status', async () => {
      const invalidStatusData = {
        status: 'invalid-status'
      };
      
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', authToken)
        .send(invalidStatusData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
        errors: expect.any(Array)
      });
      
      expect(userManager.updateUserStatus).not.toHaveBeenCalled();
    });
  });
});
