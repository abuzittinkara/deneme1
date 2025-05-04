/**
 * src/tests/setup.ts
 * Test ortamı kurulumu
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../utils/logger';

// MongoDB bellek sunucusu
let mongoServer: MongoMemoryServer;

// Test öncesi kurulum
export async function setupTestDatabase(): Promise<void> {
  try {
    // MongoDB bellek sunucusunu başlat
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Mongoose bağlantısını kur
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    } as any);
    
    logger.info('Test veritabanı bağlantısı kuruldu', { uri: mongoUri });
  } catch (error) {
    logger.error('Test veritabanı kurulumu sırasında hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

// Test sonrası temizlik
export async function teardownTestDatabase(): Promise<void> {
  try {
    // Mongoose bağlantısını kapat
    await mongoose.disconnect();
    
    // MongoDB bellek sunucusunu durdur
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    logger.info('Test veritabanı bağlantısı kapatıldı');
  } catch (error) {
    logger.error('Test veritabanı temizliği sırasında hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

// Koleksiyonları temizle
export async function clearCollections(): Promise<void> {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    logger.info('Test koleksiyonları temizlendi');
  } catch (error) {
    logger.error('Test koleksiyonları temizlenirken hata oluştu', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

export default {
  setupTestDatabase,
  teardownTestDatabase,
  clearCollections
};
