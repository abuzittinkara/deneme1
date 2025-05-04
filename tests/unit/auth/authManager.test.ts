/**
 * tests/unit/auth/authManager.test.ts
 * Auth Manager birim testleri
 */
import * as authManager from '../../../src/modules/auth/authManager';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../../../src/models/User';

// Mock User modeli
jest.mock('../../../src/models/User', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
  }
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

// Mock jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('Auth Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    it('should login a user successfully', async () => {
      // Mock verileri
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        name: 'Test',
        surname: 'User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        lastSeen: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock fonksiyonları
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      // Test
      const result = await authManager.loginUser('testuser', 'password123');

      // Doğrulama
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: 'testuser' },
          { email: 'testuser' }
        ]
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        userId: mockUser._id.toString(),
        username: mockUser.username,
        name: mockUser.name,
        surname: mockUser.surname,
        email: mockUser.email,
        role: mockUser.role,
        profilePicture: undefined,
        isEmailVerified: mockUser.emailVerified,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: expect.any(Number),
      });
    });

    it('should return error for invalid credentials', async () => {
      // Mock verileri
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'testuser',
        passwordHash: 'hashedpassword',
        isActive: true,
      };

      // Mock fonksiyonları
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Test ve doğrulama
      await expect(authManager.loginUser('testuser', 'wrongpassword')).rejects.toThrow('Geçersiz kullanıcı adı/e-posta veya şifre');
    });

    it('should return error for inactive user', async () => {
      // Mock verileri
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'testuser',
        passwordHash: 'hashedpassword',
        isActive: false,
      };

      // Mock fonksiyonları
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Test ve doğrulama
      await expect(authManager.loginUser('testuser', 'password123')).rejects.toThrow('Hesabınız aktif değil');
    });

    it('should return error for non-existent user', async () => {
      // Mock fonksiyonları
      (User.findOne as jest.Mock).mockResolvedValue(null);

      // Test ve doğrulama
      await expect(authManager.loginUser('nonexistent', 'password123')).rejects.toThrow('Geçersiz kullanıcı adı/e-posta veya şifre');
    });

    it('should handle test user in development mode', async () => {
      // Geliştirme modunu ayarla
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Test
      const result = await authManager.loginUser('test', 'Password123');

      // Doğrulama
      expect(result).toEqual({
        success: true,
        userId: '123456789012345678901234',
        username: 'test',
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        role: 'user',
        profilePicture: undefined,
        isEmailVerified: true,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      });

      // Temizlik
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      // Mock fonksiyonları
      (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user-id', username: 'testuser', role: 'user' });

      // Test
      const result = authManager.verifyAccessToken('valid-token');

      // Doğrulama
      expect(jwt.verify).toHaveBeenCalled();
      expect(result).toEqual({ sub: 'user-id', username: 'testuser', role: 'user' });
    });

    it('should return null for invalid token', () => {
      // Mock fonksiyonları
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Test
      const result = authManager.verifyAccessToken('invalid-token');

      // Doğrulama
      expect(result).toBeNull();
    });

    it('should handle test token in development mode', () => {
      // Geliştirme modunu ayarla
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Test
      const result = authManager.verifyAccessToken('test-access-token');

      // Doğrulama
      expect(result).toEqual({
        sub: '123456789012345678901234',
        username: 'test',
        role: 'user'
      });

      // Temizlik
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
