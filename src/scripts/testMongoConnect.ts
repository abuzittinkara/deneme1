/**
 * src/scripts/testMongoConnect.ts
 * MongoDB bağlantısını test etmek için basit bir script
 */
import mongoose from 'mongoose';
import { MONGODB_URI, MONGODB_URI_SAFE, mongooseOptions } from '../config/database';

async function testMongoDBConnection() {
  console.log('MongoDB bağlantısı test ediliyor...');
  console.log(`Bağlantı URL'si: ${MONGODB_URI_SAFE}`);

  try {
    // MongoDB'ye bağlan
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    console.log('MongoDB bağlantısı başarılı!');

    // Veritabanı listesini al
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log('Veritabanları:');
    dbs.databases.forEach((db: any) => {
      console.log(`- ${db.name}`);
    });

    // Koleksiyonları listele
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Koleksiyonlar:');
    collections.forEach((collection: any) => {
      console.log(`- ${collection.name}`);
    });

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
