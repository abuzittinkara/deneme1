# Performans Optimizasyonu

Bu dokümantasyon, uygulamanın performans optimizasyonu için kullanılan araçları ve teknikleri açıklar.

## İçindekiler

1. [Veritabanı Optimizasyonu](#veritabanı-optimizasyonu)
2. [Bellek Optimizasyonu](#bellek-optimizasyonu)
3. [Asenkron İşlem Optimizasyonu](#asenkron-i̇şlem-optimizasyonu)
4. [Performans İzleme](#performans-i̇zleme)
5. [Önbellek Stratejileri](#önbellek-stratejileri)

## Veritabanı Optimizasyonu

### Sorgu Optimizasyonu

Veritabanı sorgularını optimize etmek için `src/utils/db-helpers.ts` ve `src/utils/queryOptimizer.ts` modüllerini kullanabilirsiniz.

```typescript
import { paginateQuery, optimizeQuery } from '../utils/db-helpers';

// Sayfalama ile sorgu
const result = await paginateQuery(User.find({ status: 'active' }), {
  page: 1,
  limit: 20,
  sort: { createdAt: -1 },
  select: 'username email name',
  lean: true
});

// Optimize edilmiş sorgu
const user = await optimizeQuery(
  User.findById(userId),
  {
    select: 'username email name',
    populate: 'groups',
    lean: true,
    timeout: 5000
  }
).exec();
```

### Toplu İşlemler

Çok sayıda belge üzerinde işlem yaparken, toplu işlem fonksiyonlarını kullanın:

```typescript
import { batchItems, processBatch } from '../utils/db-helpers';

// Belgeleri grupla
const batches = batchItems(users, 100);

// Toplu işlem yap
const results = await processBatch(
  users,
  async (batch) => {
    return Promise.all(batch.map(user => updateUser(user)));
  },
  100
);
```

### İndeksleme

Veritabanı indekslerini oluşturmak için `createIndexes` fonksiyonunu kullanın:

```typescript
import { createIndexes } from '../utils/db-helpers';

// Uygulama başlangıcında indeksleri oluştur
await createIndexes();
```

## Bellek Optimizasyonu

Bellek kullanımını optimize etmek için `src/utils/memoryOptimizer.ts` modülünü kullanabilirsiniz.

### Bellek Kullanımını İzleme

```typescript
import { 
  getMemoryUsage, 
  logMemoryUsage, 
  monitorMemoryUsage 
} from '../utils/memoryOptimizer';

// Mevcut bellek kullanımını al
const memoryUsage = getMemoryUsage();
console.log(`Heap kullanımı: ${memoryUsage.heapUsed} bayt`);

// Bellek kullanımını logla
logMemoryUsage('İşlem sonrası bellek kullanımı');

// Bellek kullanımını izle (1GB eşik değeri ile)
const stopMonitoring = monitorMemoryUsage(1024, 60000);

// İzlemeyi durdur
stopMonitoring();
```

### Bellek Sızıntılarını Tespit Etme

```typescript
import { detectMemoryLeaks } from '../utils/memoryOptimizer';

// Bellek sızıntılarını tespit et (60 saniyede bir, 5 örnek)
const stopDetecting = detectMemoryLeaks(60000, 5);

// Tespit etmeyi durdur
stopDetecting();
```

### Büyük Nesneleri Temizleme

```typescript
import { cleanupLargeObject } from '../utils/memoryOptimizer';

// Büyük bir nesneyi temizle
const largeObject = { /* ... */ };
cleanupLargeObject(largeObject);
```

## Asenkron İşlem Optimizasyonu

Asenkron işlemleri optimize etmek için `src/utils/asyncOptimizer.ts` modülünü kullanabilirsiniz.

### Zaman Aşımı ve Yeniden Deneme

```typescript
import { 
  withTimeout, 
  withRetry, 
  withTimeoutAndRetry 
} from '../utils/asyncOptimizer';

// Zaman aşımı ile işlem
const result1 = await withTimeout(
  fetchData(),
  5000,
  'Veri getirme zaman aşımına uğradı'
);

// Yeniden deneme ile işlem
const result2 = await withRetry(
  fetchData,
  {
    retries: 3,
    retryDelay: 1000,
    onRetry: (error, attempt) => {
      console.log(`Hata: ${error.message}, Deneme: ${attempt}`);
    }
  }
);

// Hem zaman aşımı hem de yeniden deneme ile işlem
const result3 = await withTimeoutAndRetry(
  fetchData,
  {
    timeout: 5000,
    retries: 3,
    retryDelay: 1000
  }
);
```

### Paralel ve Sıralı İşlemler

```typescript
import { parallelLimit, sequential } from '../utils/asyncOptimizer';

// Paralel işlemler (maksimum 5 eşzamanlı işlem)
const results1 = await parallelLimit(
  [
    () => fetchUser(1),
    () => fetchUser(2),
    () => fetchUser(3),
    // ...
  ],
  5
);

// Sıralı işlemler
const results2 = await sequential([
  () => step1(),
  () => step2(),
  () => step3()
]);
```

### Önbellekleme

```typescript
import { memoizeAsync } from '../utils/asyncOptimizer';

// Asenkron fonksiyonu önbellekle
const fetchUserMemoized = memoizeAsync(
  fetchUser,
  (id) => `user:${id}`,
  60000 // 1 dakika önbellek süresi
);

// İlk çağrı (veritabanından getirir)
const user1 = await fetchUserMemoized(123);

// İkinci çağrı (önbellekten getirir)
const user2 = await fetchUserMemoized(123);
```

## Performans İzleme

Performans izleme için `src/middleware/performanceMiddleware.ts` modülünü kullanabilirsiniz.

### Express Middleware'leri

```typescript
import {
  requestDuration,
  memoryUsageMonitor,
  cpuUsageMonitor,
  largeResponseMonitor,
  performanceMonitoring
} from '../middleware/performanceMiddleware';

// Tek bir middleware
app.use(requestDuration);

// veya tüm performans middleware'lerini birleştiren fonksiyon
app.use(performanceMonitoring);
```

### Performans Ölçümü

```typescript
import { performance } from '../utils/performance';

// Veritabanı sorgusu performansını ölç
const result = await performance.measureDatabaseQuery(
  'User.findById',
  () => User.findById(userId).exec(),
  { userId }
);

// Redis işlemi performansını ölç
const cachedData = await performance.measureRedisOperation(
  'cache.get',
  () => redisClient.get(`user:${userId}`),
  { userId }
);

// Harici API çağrısı performansını ölç
const apiData = await performance.measureApiCall(
  'externalApi.fetchData',
  () => axios.get('https://api.example.com/data'),
  { endpoint: '/data' }
);
```

## Önbellek Stratejileri

### Bellek İçi Önbellek

```typescript
import { memoizeAsync } from '../utils/asyncOptimizer';

// Asenkron fonksiyonu önbellekle
const fetchDataMemoized = memoizeAsync(
  fetchData,
  (params) => JSON.stringify(params),
  60000 // 1 dakika önbellek süresi
);
```

### Redis Önbelleği

```typescript
import { redisClient } from '../config/redis';
import { performance } from '../utils/performance';

// Veriyi önbellekten getir veya hesapla
async function getCachedData(key, ttl = 3600) {
  // Önbellekten getirmeyi dene
  const cachedData = await performance.measureRedisOperation(
    'cache.get',
    () => redisClient.get(key)
  );
  
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  
  // Önbellekte yoksa hesapla
  const data = await fetchData();
  
  // Önbelleğe kaydet
  await performance.measureRedisOperation(
    'cache.set',
    () => redisClient.set(key, JSON.stringify(data), 'EX', ttl)
  );
  
  return data;
}
```

### HTTP Önbelleği

Express uygulamasında HTTP önbelleği için:

```typescript
import express from 'express';

const app = express();

// Statik dosyalar için önbellek
app.use(express.static('public', {
  maxAge: '1d' // 1 gün önbellek
}));

// API yanıtları için önbellek
app.get('/api/data', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 saat önbellek
  res.json({ data: 'example' });
});
```
