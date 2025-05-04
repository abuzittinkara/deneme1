/**
 * src/utils/db-monitor.ts
 * Veritabanı izleme ve analiz yardımcı fonksiyonları
 */
import mongoose from 'mongoose';
import { logger } from './logger';
import { env } from '../config/env';
import { EventEmitter } from 'events';
import { getCachedData } from '../config/redis';

// Veritabanı olayları için EventEmitter
export const dbEmitter = new EventEmitter();

// Veritabanı sorgu istatistikleri
interface QueryStats {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  errors: number;
}

// Veritabanı sorgu istatistikleri
const queryStats: Record<string, QueryStats> = {
  find: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  findOne: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  findById: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  updateOne: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  updateMany: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  deleteOne: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  deleteMany: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  insertOne: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  insertMany: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  aggregate: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 },
  other: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity, errors: 0 }
};

// Veritabanı bağlantı istatistikleri
const connectionStats = {
  connectCount: 0,
  disconnectCount: 0,
  reconnectCount: 0,
  errorCount: 0,
  lastConnectTime: 0,
  lastDisconnectTime: 0,
  lastErrorTime: 0,
  totalConnectTime: 0,
  totalDisconnectTime: 0,
  uptime: 0,
  downtime: 0,
  status: 'disconnected'
};

// Veritabanı izleme durumu
let isMonitoring = false;
let monitoringInterval: NodeJS.Timeout | null = null;

// Yavaş sorgu eşiği (ms)
const SLOW_QUERY_THRESHOLD = 500;

// Kritik sorgu eşiği (ms)
const CRITICAL_QUERY_THRESHOLD = 2000;

/**
 * Veritabanı izlemeyi başlat
 */
export function startDatabaseMonitoring(): void {
  if (isMonitoring) {
    return;
  }
  
  try {
    isMonitoring = true;
    
    // Mongoose sorgu olaylarını dinle
    setupMongooseHooks();
    
    // Bağlantı olaylarını dinle
    setupConnectionListeners();
    
    // Periyodik izleme
    if (!monitoringInterval) {
      monitoringInterval = setInterval(() => {
        logDatabaseStats();
      }, 15 * 60 * 1000); // 15 dakikada bir
      
      monitoringInterval.unref(); // Ana sürecin kapanmasını engelleme
    }
    
    logger.info('Veritabanı izleme başlatıldı');
  } catch (error) {
    logger.error('Veritabanı izleme başlatma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}

/**
 * Veritabanı izlemeyi durdur
 */
export function stopDatabaseMonitoring(): void {
  if (!isMonitoring) {
    return;
  }
  
  try {
    isMonitoring = false;
    
    // Periyodik izlemeyi durdur
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    
    // Mongoose kancalarını kaldır
    removeMongooseHooks();
    
    logger.info('Veritabanı izleme durduruldu');
  } catch (error) {
    logger.error('Veritabanı izleme durdurma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}

/**
 * Mongoose kancalarını kur
 */
function setupMongooseHooks(): void {
  // Mongoose sorgu kancalarını kur
  const originalExec = mongoose.Query.prototype.exec;
  
  // @ts-ignore - Mongoose tiplerini genişletiyoruz
  mongoose.Query.prototype.exec = async function(...args: any[]) {
    const startTime = Date.now();
    const queryType = this.op || 'other';
    
    try {
      // Orijinal sorguyu çalıştır
      const result = await originalExec.apply(this, args);
      
      // Sorgu süresini hesapla
      const duration = Date.now() - startTime;
      
      // Sorgu istatistiklerini güncelle
      updateQueryStats(queryType, duration, false);
      
      // Yavaş sorguları logla
      if (duration > SLOW_QUERY_THRESHOLD) {
        logSlowQuery(this, duration);
      }
      
      return result;
    } catch (error) {
      // Sorgu süresini hesapla
      const duration = Date.now() - startTime;
      
      // Sorgu istatistiklerini güncelle
      updateQueryStats(queryType, duration, true);
      
      // Sorgu hatasını logla
      logQueryError(this, error as Error);
      
      throw error;
    }
  };
  
  // Mongoose aggregate kancalarını kur
  const originalAggregateExec = mongoose.Aggregate.prototype.exec;
  
  // @ts-ignore - Mongoose tiplerini genişletiyoruz
  mongoose.Aggregate.prototype.exec = async function(...args: any[]) {
    const startTime = Date.now();
    
    try {
      // Orijinal aggregate'i çalıştır
      const result = await originalAggregateExec.apply(this, args);
      
      // Sorgu süresini hesapla
      const duration = Date.now() - startTime;
      
      // Sorgu istatistiklerini güncelle
      updateQueryStats('aggregate', duration, false);
      
      // Yavaş sorguları logla
      if (duration > SLOW_QUERY_THRESHOLD) {
        logSlowAggregate(this, duration);
      }
      
      return result;
    } catch (error) {
      // Sorgu süresini hesapla
      const duration = Date.now() - startTime;
      
      // Sorgu istatistiklerini güncelle
      updateQueryStats('aggregate', duration, true);
      
      // Sorgu hatasını logla
      logAggregateError(this, error as Error);
      
      throw error;
    }
  };
}

/**
 * Mongoose kancalarını kaldır
 */
function removeMongooseHooks(): void {
  // Kancaları kaldırmak için orijinal fonksiyonları geri yükle
  // Not: Bu fonksiyon şu anda bir şey yapmıyor, çünkü orijinal fonksiyonları saklamıyoruz
  // Gerçek bir uygulamada, orijinal fonksiyonları bir yerde saklayıp burada geri yüklememiz gerekir
}

/**
 * Bağlantı dinleyicilerini kur
 */
function setupConnectionListeners(): void {
  // Bağlantı olaylarını dinle
  mongoose.connection.on('connected', () => {
    connectionStats.connectCount++;
    connectionStats.lastConnectTime = Date.now();
    connectionStats.status = 'connected';
    
    // Bağlantı süresini hesapla
    if (connectionStats.lastDisconnectTime > 0) {
      connectionStats.downtime += connectionStats.lastConnectTime - connectionStats.lastDisconnectTime;
    }
    
    // Bağlantı olayını yayınla
    dbEmitter.emit('connected', {
      timestamp: connectionStats.lastConnectTime,
      connectCount: connectionStats.connectCount
    });
  });
  
  mongoose.connection.on('disconnected', () => {
    connectionStats.disconnectCount++;
    connectionStats.lastDisconnectTime = Date.now();
    connectionStats.status = 'disconnected';
    
    // Bağlantı süresini hesapla
    if (connectionStats.lastConnectTime > 0) {
      connectionStats.uptime += connectionStats.lastDisconnectTime - connectionStats.lastConnectTime;
    }
    
    // Bağlantı olayını yayınla
    dbEmitter.emit('disconnected', {
      timestamp: connectionStats.lastDisconnectTime,
      disconnectCount: connectionStats.disconnectCount
    });
  });
  
  mongoose.connection.on('reconnected', () => {
    connectionStats.reconnectCount++;
    connectionStats.lastConnectTime = Date.now();
    connectionStats.status = 'connected';
    
    // Bağlantı olayını yayınla
    dbEmitter.emit('reconnected', {
      timestamp: connectionStats.lastConnectTime,
      reconnectCount: connectionStats.reconnectCount
    });
  });
  
  mongoose.connection.on('error', (err) => {
    connectionStats.errorCount++;
    connectionStats.lastErrorTime = Date.now();
    
    // Bağlantı olayını yayınla
    dbEmitter.emit('error', {
      timestamp: connectionStats.lastErrorTime,
      errorCount: connectionStats.errorCount,
      error: err.message
    });
  });
}

/**
 * Sorgu istatistiklerini güncelle
 * @param queryType - Sorgu türü
 * @param duration - Sorgu süresi (ms)
 * @param isError - Hata mı?
 */
function updateQueryStats(queryType: string, duration: number, isError: boolean): void {
  // Sorgu türünü kontrol et
  if (!queryStats[queryType]) {
    queryType = 'other';
  }
  
  // Sorgu sayısını artır
  queryStats[queryType].count++;
  
  // Hata sayısını artır
  if (isError) {
    queryStats[queryType].errors++;
  } else {
    // Sorgu süresini güncelle
    queryStats[queryType].totalTime += duration;
    queryStats[queryType].avgTime = queryStats[queryType].totalTime / (queryStats[queryType].count - queryStats[queryType].errors);
    
    // Maksimum ve minimum süreleri güncelle
    if (duration > queryStats[queryType].maxTime) {
      queryStats[queryType].maxTime = duration;
    }
    
    if (duration < queryStats[queryType].minTime) {
      queryStats[queryType].minTime = duration;
    }
  }
}

/**
 * Yavaş sorguyu logla
 * @param query - Mongoose sorgusu
 * @param duration - Sorgu süresi (ms)
 */
function logSlowQuery(query: mongoose.Query<any, any>, duration: number): void {
  const queryInfo = {
    model: query.model?.modelName || 'Unknown',
    operation: query.op || 'unknown',
    filter: JSON.stringify(query.getFilter()),
    projection: JSON.stringify(query.getOptions().projection || {}),
    options: JSON.stringify(query.getOptions()),
    duration: `${duration}ms`
  };
  
  // Sorgu süresine göre log seviyesini belirle
  if (duration > CRITICAL_QUERY_THRESHOLD) {
    logger.warn('Kritik yavaş sorgu tespit edildi', { query: queryInfo });
    
    // Kritik yavaş sorgu olayını yayınla
    dbEmitter.emit('critical_slow_query', {
      ...queryInfo,
      timestamp: Date.now()
    });
  } else {
    logger.debug('Yavaş sorgu tespit edildi', { query: queryInfo });
    
    // Yavaş sorgu olayını yayınla
    dbEmitter.emit('slow_query', {
      ...queryInfo,
      timestamp: Date.now()
    });
  }
}

/**
 * Yavaş aggregate'i logla
 * @param aggregate - Mongoose aggregate
 * @param duration - Sorgu süresi (ms)
 */
function logSlowAggregate(aggregate: mongoose.Aggregate<any>, duration: number): void {
  const aggregateInfo = {
    model: aggregate.model?.modelName || 'Unknown',
    pipeline: JSON.stringify(aggregate.pipeline()),
    options: JSON.stringify(aggregate.options || {}),
    duration: `${duration}ms`
  };
  
  // Sorgu süresine göre log seviyesini belirle
  if (duration > CRITICAL_QUERY_THRESHOLD) {
    logger.warn('Kritik yavaş aggregate tespit edildi', { aggregate: aggregateInfo });
    
    // Kritik yavaş aggregate olayını yayınla
    dbEmitter.emit('critical_slow_aggregate', {
      ...aggregateInfo,
      timestamp: Date.now()
    });
  } else {
    logger.debug('Yavaş aggregate tespit edildi', { aggregate: aggregateInfo });
    
    // Yavaş aggregate olayını yayınla
    dbEmitter.emit('slow_aggregate', {
      ...aggregateInfo,
      timestamp: Date.now()
    });
  }
}

/**
 * Sorgu hatasını logla
 * @param query - Mongoose sorgusu
 * @param error - Hata
 */
function logQueryError(query: mongoose.Query<any, any>, error: Error): void {
  const queryInfo = {
    model: query.model?.modelName || 'Unknown',
    operation: query.op || 'unknown',
    filter: JSON.stringify(query.getFilter()),
    projection: JSON.stringify(query.getOptions().projection || {}),
    options: JSON.stringify(query.getOptions()),
    error: error.message,
    stack: error.stack
  };
  
  logger.error('Sorgu hatası', { query: queryInfo });
  
  // Sorgu hatası olayını yayınla
  dbEmitter.emit('query_error', {
    ...queryInfo,
    timestamp: Date.now()
  });
}

/**
 * Aggregate hatasını logla
 * @param aggregate - Mongoose aggregate
 * @param error - Hata
 */
function logAggregateError(aggregate: mongoose.Aggregate<any>, error: Error): void {
  const aggregateInfo = {
    model: aggregate.model?.modelName || 'Unknown',
    pipeline: JSON.stringify(aggregate.pipeline()),
    options: JSON.stringify(aggregate.options || {}),
    error: error.message,
    stack: error.stack
  };
  
  logger.error('Aggregate hatası', { aggregate: aggregateInfo });
  
  // Aggregate hatası olayını yayınla
  dbEmitter.emit('aggregate_error', {
    ...aggregateInfo,
    timestamp: Date.now()
  });
}

/**
 * Veritabanı istatistiklerini logla
 */
function logDatabaseStats(): void {
  try {
    // Bağlantı durumunu kontrol et
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    
    // Sorgu istatistiklerini logla
    logger.info('Veritabanı sorgu istatistikleri', {
      metadata: {
        queryStats,
        connectionStats: {
          connectCount: connectionStats.connectCount,
          disconnectCount: connectionStats.disconnectCount,
          reconnectCount: connectionStats.reconnectCount,
          errorCount: connectionStats.errorCount,
          uptime: formatDuration(connectionStats.uptime),
          downtime: formatDuration(connectionStats.downtime),
          status: connectionStats.status
        }
      }
    });
    
    // Veritabanı istatistikleri olayını yayınla
    dbEmitter.emit('stats', {
      queryStats,
      connectionStats,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Veritabanı istatistikleri loglama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}

/**
 * Süreyi formatla
 * @param ms - Milisaniye
 * @returns Formatlanmış süre
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Veritabanı istatistiklerini al
 */
export async function getDatabaseStats(): Promise<any> {
  return await getCachedData(
    'database:stats',
    async () => {
      try {
        // Bağlantı durumunu kontrol et
        if (mongoose.connection.readyState !== 1) {
          return {
            status: 'disconnected',
            queryStats: {},
            connectionStats: {
              ...connectionStats,
              uptime: formatDuration(connectionStats.uptime),
              downtime: formatDuration(connectionStats.downtime)
            },
            collections: [],
            timestamp: Date.now()
          };
        }
        
        // Koleksiyon istatistiklerini al
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionStats = await Promise.all(
          collections.map(async (collection) => {
            try {
              const stats = await mongoose.connection.db.collection(collection.name).stats();
              return {
                name: collection.name,
                count: stats.count,
                size: stats.size,
                avgObjSize: stats.avgObjSize,
                storageSize: stats.storageSize,
                indexes: stats.nindexes,
                indexSize: stats.totalIndexSize
              };
            } catch (error) {
              return {
                name: collection.name,
                error: (error as Error).message
              };
            }
          })
        );
        
        // Veritabanı istatistiklerini al
        const dbStats = await mongoose.connection.db.stats();
        
        return {
          status: 'connected',
          database: {
            name: mongoose.connection.db.databaseName,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            collections: dbStats.collections,
            objects: dbStats.objects,
            dataSize: dbStats.dataSize,
            storageSize: dbStats.storageSize,
            indexes: dbStats.indexes,
            indexSize: dbStats.indexSize
          },
          queryStats: Object.entries(queryStats).map(([type, stats]) => ({
            type,
            count: stats.count,
            errors: stats.errors,
            avgTime: stats.avgTime.toFixed(2),
            maxTime: stats.maxTime,
            minTime: stats.minTime === Infinity ? 0 : stats.minTime
          })),
          connectionStats: {
            ...connectionStats,
            uptime: formatDuration(connectionStats.uptime),
            downtime: formatDuration(connectionStats.downtime)
          },
          collections: collectionStats,
          timestamp: Date.now()
        };
      } catch (error) {
        logger.error('Veritabanı istatistikleri alma hatası', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata'
        });
        
        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          timestamp: Date.now()
        };
      }
    },
    { ttl: 60, staleWhileRevalidate: true }
  );
}

// Veritabanı olaylarını dinle
dbEmitter.on('critical_slow_query', (data) => {
  // Kritik yavaş sorgu durumunda yapılacak işlemler
  // Örneğin: Bildirim gönder, alarm oluştur, vb.
  if (env.isProduction) {
    // Burada bildirim gönderme kodu olabilir
  }
});

dbEmitter.on('query_error', (data) => {
  // Sorgu hatası durumunda yapılacak işlemler
  // Örneğin: Hata izleme sistemine ekle, vb.
});

export default {
  startDatabaseMonitoring,
  stopDatabaseMonitoring,
  getDatabaseStats,
  dbEmitter
};
