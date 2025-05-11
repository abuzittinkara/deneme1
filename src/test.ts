/**
 * src/test.ts
 * Basit bir test dosyası
 */
console.log('Test başlıyor...');

// MongoDB bağlantı bilgilerini içe aktar
import { MONGODB_URI, MONGODB_URI_SAFE } from './config/database';
console.log(`MongoDB URI: ${MONGODB_URI_SAFE}`);

// Mongoose'u içe aktar
import mongoose from 'mongoose';

// Bağlantı seçenekleri
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
};

async function testMongoDBConnection() {
  console.log('MongoDB bağlantısı test ediliyor...');

  try {
    // MongoDB'ye bağlan
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    console.log('MongoDB bağlantısı başarılı!');

    // Bağlantıyı kapat
    await mongoose.connection.close();
    console.log('MongoDB bağlantısı kapatıldı');
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error);
  } finally {
    process.exit(0);
  }
}

// Testi çalıştır
testMongoDBConnection();
