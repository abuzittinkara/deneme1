/**
 * tests/unit/database/mongodb.test.ts
 * MongoDB bağlantısı için birim testleri
 */
import mongoose from 'mongoose';
import { connectDB, closeDB } from '../../../src/database/mongodb';

// Mongoose'u mock'la
jest.mock('mongoose', () => {
  return {
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      on: jest.fn(),
      once: jest.fn(),
      close: jest.fn().mockResolvedValue(true),
    },
    set: jest.fn(),
  };
});

// Environment modülünü mock'la
jest.mock('../../../src/config/environment', () => ({
  isDevelopment: jest.fn().mockImplementation(() => process.env.NODE_ENV === 'development'),
  isTest: jest.fn().mockImplementation(() => process.env.NODE_ENV === 'test'),
  isProduction: jest.fn().mockImplementation(() => process.env.NODE_ENV === 'production'),
}));

// Logger modülünü mock'la
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MongoDB Connection', () => {
  beforeEach(() => {
    // Mock'ları sıfırla
    jest.clearAllMocks();

    // Çevre değişkenlerini ayarla
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Çevre değişkenlerini temizle
    delete process.env.MONGODB_URI;
    delete process.env.NODE_ENV;
  });

  describe('connectDB', () => {
    it('should connect to MongoDB with the provided URI', async () => {
      // Test
      await connectDB();

      // Doğrulama
      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', expect.any(Object));
      expect(mongoose.set).toHaveBeenCalled();
      expect(mongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should connect to MongoDB with default URI if not provided', async () => {
      // MONGODB_URI çevre değişkenini kaldır
      delete process.env.MONGODB_URI;

      // Test
      await connectDB();

      // Doğrulama
      expect(mongoose.connect).toHaveBeenCalledWith(expect.stringContaining('mongodb://'), expect.any(Object));
    });

    it('should set debug mode in development environment', async () => {
      // Geliştirme ortamını ayarla
      process.env.NODE_ENV = 'development';

      // Test
      await connectDB();

      // Doğrulama
      expect(mongoose.set).toHaveBeenCalledWith('debug', true);
    });

    it('should not set debug mode in production environment', async () => {
      // Üretim ortamını ayarla
      process.env.NODE_ENV = 'production';

      // Test
      await connectDB();

      // Doğrulama
      expect(mongoose.set).not.toHaveBeenCalledWith('debug', true);
    });
  });

  describe('closeDB', () => {
    it('should close the MongoDB connection', async () => {
      // Test
      await closeDB();

      // Doğrulama
      expect(mongoose.connection.close).toHaveBeenCalled();
    });

    it('should handle errors when closing the connection', async () => {
      // Hata fırlatan mock
      (mongoose.connection.close as jest.Mock).mockRejectedValueOnce(new Error('Connection close error'));

      // Test ve doğrulama
      await expect(closeDB()).resolves.not.toThrow();
    });
  });
});
