import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import * as passwordUtils from '../../../src/utils/passwordUtils';

// Mock crypto modülü
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  scrypt: jest.fn(),
  timingSafeEqual: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('passwordUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password correctly', async () => {
      // Mock crypto.randomBytes
      const mockSalt = Buffer.from('mocksalt12345678');
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockSalt);

      // Mock crypto.scrypt
      const mockHash = Buffer.from('mockhash123456789012345678901234567890');
      (crypto.scrypt as jest.Mock).mockImplementation((_password, _salt, _keylen, callback) => {
        callback(null, mockHash);
      });

      const password = 'testPassword123!';
      const result = await passwordUtils.hashPassword(password);

      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      expect(crypto.scrypt).toHaveBeenCalled();
      expect(result).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/); // format: hash.salt
    });

    it('should handle errors during hashing', async () => {
      // Mock crypto.randomBytes to throw an error
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw new Error('Random bytes generation failed');
      });

      const password = 'testPassword123!';
      await expect(passwordUtils.hashPassword(password)).rejects.toThrow('Şifre hashleme hatası');
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const mockHash = Buffer.from('mockhash123456789012345678901234567890');
      const mockInputHash = Buffer.from('mockhash123456789012345678901234567890');
      
      // Mock crypto.scrypt
      (crypto.scrypt as jest.Mock).mockImplementation((_password, _salt, _keylen, callback) => {
        callback(null, mockInputHash);
      });

      // Mock crypto.timingSafeEqual
      (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);

      const password = 'testPassword123!';
      const hashedPassword = 'mockhash123456789012345678901234567890.mocksalt12345678';
      
      const result = await passwordUtils.verifyPassword(password, hashedPassword);
      
      expect(crypto.scrypt).toHaveBeenCalled();
      expect(crypto.timingSafeEqual).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const mockHash = Buffer.from('mockhash123456789012345678901234567890');
      const mockInputHash = Buffer.from('differenthash9012345678901234567890');
      
      // Mock crypto.scrypt
      (crypto.scrypt as jest.Mock).mockImplementation((_password, _salt, _keylen, callback) => {
        callback(null, mockInputHash);
      });

      // Mock crypto.timingSafeEqual
      (crypto.timingSafeEqual as jest.Mock).mockReturnValue(false);

      const password = 'wrongPassword123!';
      const hashedPassword = 'mockhash123456789012345678901234567890.mocksalt12345678';
      
      const result = await passwordUtils.verifyPassword(password, hashedPassword);
      
      expect(result).toBe(false);
    });

    it('should handle errors during verification', async () => {
      // Mock crypto.scrypt to throw an error
      (crypto.scrypt as jest.Mock).mockImplementation((_password, _salt, _keylen, callback) => {
        callback(new Error('Scrypt failed'), null);
      });

      const password = 'testPassword123!';
      const hashedPassword = 'mockhash123456789012345678901234567890.mocksalt12345678';
      
      await expect(passwordUtils.verifyPassword(password, hashedPassword)).rejects.toThrow('Şifre doğrulama hatası');
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a random password of specified length', () => {
      const mockRandomBytes = Buffer.from('abcdefghijklmnopqrstuvwxyz123456');
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockRandomBytes);
      
      const length = 12;
      const result = passwordUtils.generateRandomPassword(length);
      
      expect(result.length).toBe(length);
      expect(crypto.randomBytes).toHaveBeenCalled();
    });

    it('should handle errors and use fallback method', () => {
      // Mock crypto.randomBytes to throw an error
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw new Error('Random bytes generation failed');
      });
      
      // Mock crypto.randomBytes for the fallback to succeed
      (crypto.randomBytes as jest.Mock).mockReturnValueOnce(Buffer.from('fallbackrandom12345'));
      
      const length = 10;
      const result = passwordUtils.generateRandomPassword(length);
      
      expect(result.length).toBe(length);
    });
  });
});
