/**
 * tests/setup.ts
 * Jest test ortamı kurulumu
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../src/utils/logger';

// .env dosyasını yükle
dotenv.config({ path: '.env.test' });

// Test ortamını NODE_ENV=test olarak ayarla
process.env.NODE_ENV = 'test';

// Logger'ı sessiz moda al
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  httpLogger: {
    log: jest.fn(),
  },
  requestLogger: jest.fn().mockImplementation((req, res, next) => next()),
  logError: jest.fn(),
  measurePerformance: jest.fn().mockImplementation((name, fn) => fn()),
  dbLogger: {
    query: jest.fn(),
    error: jest.fn(),
  },
  socketLogger: {
    connection: jest.fn(),
    disconnect: jest.fn(),
    event: jest.fn(),
    error: jest.fn(),
  },
  redisLogger: {
    command: jest.fn(),
    error: jest.fn(),
  },
}));

// MongoDB bellek sunucusu
let mongoServer: MongoMemoryServer;

// Jest kurulumu
beforeAll(async () => {
  // MongoDB bellek sunucusunu başlat
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // MongoDB bağlantısını kur
  await mongoose.connect(mongoUri);
  
  console.log(`MongoDB bellek sunucusu başlatıldı: ${mongoUri}`);
});

// Her testten sonra
afterEach(async () => {
  // Tüm koleksiyonları temizle
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Tüm testler bittikten sonra
afterAll(async () => {
  // MongoDB bağlantısını kapat
  await mongoose.connection.close();
  
  // MongoDB bellek sunucusunu durdur
  await mongoServer.stop();
  
  console.log('MongoDB bellek sunucusu durduruldu');
});

// Jest zaman aşımını artır
jest.setTimeout(30000);

// Global test yardımcıları
global.testUtils = {
  // Test kullanıcısı oluştur
  createTestUser: async (userData = {}) => {
    const { User } = require('../src/models/User');
    const bcrypt = require('bcrypt');
    
    const defaultUserData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash('Password123', 10),
      name: 'Test',
      surname: 'User',
      isActive: true,
      emailVerified: true,
      role: 'user',
    };
    
    const user = new User({
      ...defaultUserData,
      ...userData,
    });
    
    await user.save();
    return user;
  },
  
  // Test grubu oluştur
  createTestGroup: async (groupData = {}) => {
    const { Group } = require('../src/models/Group');
    
    const defaultGroupData = {
      name: `Test Group ${Date.now()}`,
      description: 'Test group description',
      isPublic: true,
      owner: mongoose.Types.ObjectId(),
    };
    
    const group = new Group({
      ...defaultGroupData,
      ...groupData,
    });
    
    await group.save();
    return group;
  },
  
  // Test JWT token'ı oluştur
  generateTestToken: (userId: string, role = 'user') => {
    const jwt = require('jsonwebtoken');
    
    return jwt.sign(
      { sub: userId, role },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  },
};
