/**
 * src/__tests__/modules/profileManager.test.ts
 * profileManager modülü için birim testleri
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User';
import * as profileManager from '../../modules/profileManager';
import * as fileUpload from '../../modules/fileUpload';

// Modülleri mockla
jest.mock('../../models/User');
jest.mock('../../modules/fileUpload');
jest.mock('bcryptjs');

describe('Profile Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      // Mock User.findById
      const mockUser = {
        _id: 'user-id',
        name: 'Old Name',
        surname: 'Old Surname',
        email: 'old@example.com',
        phone: '1234567890',
        bio: 'Old bio',
        customStatus: 'Old status',
        birthdate: new Date('1990-01-01'),
        preferences: {
          theme: 'dark',
          notifications: true,
          soundEffects: true,
          language: 'tr',
        },
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: 'user-id',
          name: 'New Name',
          surname: 'New Surname',
          email: 'new@example.com',
          phone: '0987654321',
          bio: 'New bio',
          customStatus: 'New status',
          birthdate: new Date('1995-05-05'),
          preferences: {
            theme: 'light',
            notifications: false,
            soundEffects: false,
            language: 'en',
          },
        }),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const profileData = {
        name: 'New Name',
        surname: 'New Surname',
        email: 'new@example.com',
        phone: '0987654321',
        bio: 'New bio',
        customStatus: 'New status',
        birthdate: '1995-05-05',
        preferences: {
          theme: 'light',
          notifications: false,
          soundEffects: false,
          language: 'en',
        },
      };

      const result = await profileManager.updateUserProfile('user-id', profileData);

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockUser.save).toHaveBeenCalled();

      expect(mockUser.name).toBe('New Name');
      expect(mockUser.surname).toBe('New Surname');
      expect(mockUser.email).toBe('new@example.com');
      expect(mockUser.phone).toBe('0987654321');
      expect(mockUser.bio).toBe('New bio');
      expect(mockUser.customStatus).toBe('New status');
      expect(mockUser.birthdate).toEqual(new Date('1995-05-05'));
      expect(mockUser.preferences.theme).toBe('light');
      expect(mockUser.preferences.notifications).toBe(false);
      expect(mockUser.preferences.soundEffects).toBe(false);
      expect(mockUser.preferences.language).toBe('en');

      expect(result).toEqual({
        _id: 'user-id',
        name: 'New Name',
        surname: 'New Surname',
        email: 'new@example.com',
        phone: '0987654321',
        bio: 'New bio',
        customStatus: 'New status',
        birthdate: new Date('1995-05-05'),
        preferences: {
          theme: 'light',
          notifications: false,
          soundEffects: false,
          language: 'en',
        },
      });
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(profileManager.updateUserProfile('user-id', {})).rejects.toThrow(
        'Kullanıcı bulunamadı'
      );
    });
  });

  describe('changeUserPassword', () => {
    it('should change password successfully', async () => {
      // Mock User.findById
      const mockUser = {
        _id: 'user-id',
        passwordHash: 'old-hash',
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await profileManager.changeUserPassword(
        'user-id',
        'current-password',
        'new-password'
      );

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(bcrypt.compare).toHaveBeenCalledWith('current-password', 'old-hash');
      expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 10);
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.passwordHash).toBe('new-hash');

      expect(result).toEqual({
        success: true,
        message: 'Şifre başarıyla güncellendi',
      });
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        profileManager.changeUserPassword('user-id', 'current-password', 'new-password')
      ).rejects.toThrow('Kullanıcı bulunamadı');
    });

    it('should throw error if current password is incorrect', async () => {
      // Mock User.findById
      const mockUser = {
        _id: 'user-id',
        passwordHash: 'old-hash',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        profileManager.changeUserPassword('user-id', 'wrong-password', 'new-password')
      ).rejects.toThrow('Mevcut şifre hatalı');
    });
  });

  describe('updateProfilePicture', () => {
    it('should update profile picture successfully', async () => {
      // Mock User.findById
      const mockUser = {
        _id: 'user-id',
        profilePicture: 'old-picture-id',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockFileAttachment = {
        _id: 'new-picture-id',
        originalName: 'profile.jpg',
        path: '/uploads/profile.jpg',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (fileUpload.deleteFile as jest.Mock).mockResolvedValue(true);
      (fileUpload.handleFileUpload as jest.Mock).mockResolvedValue(mockFileAttachment);

      const result = await profileManager.updateProfilePicture(
        'user-id',
        'base64-data',
        'profile.jpg',
        'image/jpeg'
      );

      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(fileUpload.deleteFile).toHaveBeenCalledWith('old-picture-id');
      expect(fileUpload.handleFileUpload).toHaveBeenCalledWith(
        'base64-data',
        'profile.jpg',
        'image/jpeg',
        'user-id'
      );
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.profilePicture).toBe('new-picture-id');

      expect(result).toEqual({
        success: true,
        profilePicture: mockFileAttachment,
      });
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        profileManager.updateProfilePicture('user-id', 'base64-data', 'profile.jpg', 'image/jpeg')
      ).rejects.toThrow('Kullanıcı bulunamadı');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      // Mock User.findById
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        profilePicture: 'picture-id',
      };

      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser),
        }),
      });

      const result = await profileManager.getUserProfile('user-id');

      expect(User.findById).toHaveBeenCalledWith('user-id');

      expect(result).toEqual({
        _id: 'user-id',
        username: 'testuser',
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        profilePicture: 'picture-id',
      });

      // passwordHash should be removed
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(profileManager.getUserProfile('user-id')).rejects.toThrow(
        'Kullanıcı bulunamadı'
      );
    });
  });
});
