/**
 * src/services/atlasSQLService.ts
 * MongoDB Atlas SQL Federated Database Instance ile etkileşim için servis
 */
import { Collection, Document, MongoClient } from 'mongodb';
import atlasSQL from '../config/atlasSQL';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Atlas SQL Servis Sınıfı
 */
class AtlasSQLService {
  private client: MongoClient | null = null;
  private database: string;
  private isConnected: boolean = false;

  /**
   * AtlasSQLService constructor
   * @param database - Veritabanı adı
   */
  constructor(database: string = env.ATLAS_SQL_DATABASE) {
    this.database = database;
  }

  /**
   * Atlas SQL'e bağlanır
   * @returns Bağlantı başarılı mı
   */
  async connect(): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        return true;
      }

      this.client = await atlasSQL.connectToAtlasSQL();
      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error('Atlas SQL bağlantı hatası', {
        error: (error as Error).message,
        database: this.database,
      });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Atlas SQL bağlantısını kapatır
   */
  async disconnect(): Promise<void> {
    try {
      await atlasSQL.disconnectFromAtlasSQL();
      this.client = null;
      this.isConnected = false;
    } catch (error) {
      logger.error('Atlas SQL bağlantısını kapatma hatası', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Koleksiyon nesnesini döndürür
   * @param collectionName - Koleksiyon adı
   * @returns Koleksiyon nesnesi
   */
  getCollection<T extends Document>(collectionName: string): Collection<T> | null {
    if (!this.client) {
      logger.error('Atlas SQL bağlantısı kurulmadan koleksiyon erişimi denendi', {
        collection: collectionName,
      });
      return null;
    }

    return this.client.db(this.database).collection<T>(collectionName);
  }

  /**
   * SQL sorgusu çalıştırır
   * @param query - SQL sorgusu
   * @returns Sorgu sonuçları
   */
  async executeSQL(query: string): Promise<any[]> {
    try {
      if (!this.client) {
        await this.connect();
      }

      if (!this.client) {
        throw new Error('Atlas SQL bağlantısı kurulamadı');
      }

      // SQL sorgusu çalıştır (doğrudan veritabanı üzerinde)
      const result = await this.client
        .db(this.database)
        .aggregate([
          {
            $sql: {
              statement: query,
            },
          },
        ])
        .toArray();

      return result;
    } catch (error) {
      logger.error('SQL sorgusu çalıştırma hatası', {
        error: (error as Error).message,
        query,
      });
      throw error;
    }
  }

  /**
   * Bağlantı durumunu kontrol eder
   * @returns Bağlantı durumu
   */
  async checkConnection(): Promise<{
    isConnected: boolean;
    database: string;
    collections?: string[];
    error?: string;
  }> {
    try {
      if (!this.client) {
        await this.connect();
      }

      if (!this.client) {
        return {
          isConnected: false,
          database: this.database,
          error: 'Atlas SQL bağlantısı kurulamadı',
        };
      }

      // Koleksiyonları listele
      const collections = await this.client.db(this.database).listCollections().toArray();

      return {
        isConnected: true,
        database: this.database,
        collections: collections.map((c) => c.name),
      };
    } catch (error) {
      return {
        isConnected: false,
        database: this.database,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Veritabanı şemasını getirir
   * @returns Şema bilgileri
   */
  async getSchema(): Promise<any> {
    try {
      if (!this.client) {
        await this.connect();
      }

      if (!this.client) {
        throw new Error('Atlas SQL bağlantısı kurulamadı');
      }

      // Şema bilgilerini getir
      const collections = await this.client.db(this.database).listCollections().toArray();

      const schema: Record<string, any> = {};

      // Her koleksiyon için şema bilgilerini getir
      for (const collection of collections) {
        const sample = await this.client.db(this.database).collection(collection.name).findOne({});

        schema[collection.name] = {
          fields: sample
            ? Object.keys(sample).map((key) => ({
              name: key,
              type: typeof sample[key],
              sample: sample[key],
            }))
            : [],
        };
      }

      return schema;
    } catch (error) {
      logger.error('Şema bilgilerini getirme hatası', {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Singleton instance
export const atlasSQLService = new AtlasSQLService();

export default atlasSQLService;
