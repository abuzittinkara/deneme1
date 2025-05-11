/**
 * src/database/mongodb.ts
 * MongoDB bağlantı yöneticisi
 */
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { isDevelopment } from '../config/environment';

/**
 * MongoDB'ye bağlanır
 * @param uri - MongoDB bağlantı URI'si (opsiyonel)
 * @returns Mongoose bağlantısı
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  try {
    // Bağlantı URI'sini belirle
    const connectionURI = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/app';

    // Geliştirme modunda debug'ı etkinleştir
    if (isDevelopment()) {
      mongoose.set('debug', true);
    } else {
      mongoose.set('debug', false);
    }

    // Mongoose yapılandırması
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // IPv4
    };

    // MongoDB'ye bağlan
    await mongoose.connect(connectionURI, options);

    // Bağlantı olaylarını dinle
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB bağlantı hatası', { error: err.message });
    });

    mongoose.connection.once('open', () => {
      logger.info('MongoDB bağlantısı başarılı', { uri: connectionURI });
    });

    return mongoose;
  } catch (error) {
    logger.error('MongoDB bağlantısı kurulamadı', { error: (error as Error).message });
    throw error;
  }
}

/**
 * MongoDB bağlantısını kapatır
 */
export async function closeDB(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB bağlantısı kapatıldı');
  } catch (error) {
    logger.error('MongoDB bağlantısı kapatılırken hata oluştu', {
      error: (error as Error).message,
    });
  }
}
