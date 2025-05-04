/**
 * scripts/testMongoConnection.ts
 * MongoDB Atlas bağlantısını test etmek için script
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { MONGODB_URI, MONGODB_URI_SAFE } from '../src/config/database';

async function testConnection() {
  console.log('MongoDB bağlantısı test ediliyor...');
  console.log(`Bağlantı URI: ${MONGODB_URI_SAFE}`);

  try {
    // Bağlantıyı aç
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB bağlantısı başarılı!');

    // Veritabanı listesini al
    if (mongoose.connection.db) {
      const adminDb = mongoose.connection.db.admin();
      const { databases } = await adminDb.listDatabases();

      console.log('\nMevcut veritabanları:');
      databases.forEach((db: any) => {
        console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });

      // Koleksiyonları listele
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();

      console.log('\nMevcut koleksiyonlar:');
      collections.forEach((collection: any) => {
        console.log(`- ${collection.name}`);
      });

      // Örnek bir sorgu çalıştır
      console.log('\nÖrnek bir sorgu çalıştırılıyor...');
      const sampleCollection = collections[0]?.name;

      if (sampleCollection) {
        const count = await db.collection(sampleCollection).countDocuments();
        console.log(`"${sampleCollection}" koleksiyonunda ${count} belge bulunuyor.`);

        const sampleDocument = await db.collection(sampleCollection).findOne({});
        console.log(`Örnek belge: ${JSON.stringify(sampleDocument, null, 2).substring(0, 200)}...`);
      } else {
        console.log('Hiç koleksiyon bulunamadı.');
      }
    } else {
      console.log('\nVeritabanı bağlantısı kuruldu, ancak veritabanı nesnesi oluşturulamadı.');
    }

    // Bağlantıyı kapat
    await mongoose.connection.close();
    console.log('\nMongoDB bağlantısı kapatıldı.');
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error);
  }
}

// Scripti çalıştır
testConnection().catch(console.error);
