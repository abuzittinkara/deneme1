# Performans İzleme ve Optimizasyon Kılavuzu

Bu dokümantasyon, performans izleme ve optimizasyon araçlarının nasıl kullanıldığını açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Performans İzleme Araçları](#performans-i̇zleme-araçları)
3. [Bellek Optimizasyonu](#bellek-optimizasyonu)
4. [Asenkron İşlem Optimizasyonu](#asenkron-i̇şlem-optimizasyonu)
5. [Veritabanı Optimizasyonu](#veritabanı-optimizasyonu)
6. [Performans İzleme Middleware'leri](#performans-i̇zleme-middlewareleri)

## Giriş

Performans izleme ve optimizasyon araçları, aşağıdaki alanlarda kullanılır:

1. **Performans İzleme**: İşlemlerin süresini ölçmek ve raporlamak için yardımcı fonksiyonlar
2. **Bellek Optimizasyonu**: Bellek kullanımını izlemek ve optimize etmek için yardımcı fonksiyonlar
3. **Asenkron İşlem Optimizasyonu**: Asenkron işlemleri optimize etmek için yardımcı fonksiyonlar
4. **Veritabanı Optimizasyonu**: Veritabanı sorgularını optimize etmek için yardımcı fonksiyonlar
5. **Performans İzleme Middleware'leri**: HTTP isteklerinin performansını izlemek için middleware'ler

## Performans İzleme Araçları

Performans izleme araçları, `src/utils/performanceMonitor.ts` dosyasında bulunur ve işlemlerin süresini ölçmek ve raporlamak için kullanılır.

### Performans Ölçümü

```typescript
import { 
  measure, 
  measureSync, 
  getRecentMeasurements, 
  getAverageDuration, 
  generatePerformanceReport, 
  startPerformanceMonitoring 
} from '../utils/performanceMonitor';

// Asenkron işlemin performansını ölç
const result = await measure(
  'fetchUserData',
  async () => {
    return await userService.getUserById(userId);
  },
  { userId }
);

// Senkron işlemin performansını ölç
const result = measureSync(
  'calculateTotal',
  () => {
    return items.reduce((total, item) => total + item.price, 0);
  },
  { itemCount: items.length }
);

// Son ölçümleri getir
const measurements = getRecentMeasurements(10);

// Ortalama süreyi hesapla
const avgDuration = getAverageDuration('fetchUserData');
console.log(`Ortalama süre: ${avgDuration.toFixed(2)}ms`);

// Performans raporu oluştur
const report = generatePerformanceReport();
console.log(report);

// Performans izlemeyi başlat (saatlik rapor)
const stopMonitoring = startPerformanceMonitoring(3600000);

// İzlemeyi durdur
stopMonitoring();
```

### Performans İzleme Başlatma

Performans izleme, `src/app.ts` dosyasında başlatılır:

```typescript
// src/app.ts
import { startPerformanceMonitoring } from './utils/performanceMonitor';

// Performans izlemeyi başlat (saatlik rapor)
const stopPerformanceMonitoring = startPerformanceMonitoring(3600000);

// Uygulama kapatıldığında izlemeyi durdur
process.on('SIGINT', () => {
  stopPerformanceMonitoring();
  process.exit(0);
});
```

## Bellek Optimizasyonu

Bellek optimizasyonu araçları, `src/utils/memoryOptimizer.ts` dosyasında bulunur ve bellek kullanımını izlemek ve optimize etmek için kullanılır.

### Bellek Kullanımını İzleme

```typescript
import { 
  getMemoryUsage, 
  logMemoryUsage, 
  monitorMemoryUsage, 
  detectMemoryLeaks, 
  cleanupLargeObject 
} from '../utils/memoryOptimizer';

// Mevcut bellek kullanımını al
const memoryUsage = getMemoryUsage();
console.log(`Heap kullanımı: ${formatMemoryUsage(memoryUsage.heapUsed)}`);

// Bellek kullanımını logla
logMemoryUsage('İşlem sonrası bellek kullanımı');

// Bellek kullanımını izle (1GB eşik değeri ile)
const stopMonitoring = monitorMemoryUsage(1024, 60000);

// Bellek sızıntılarını tespit et
const stopDetecting = detectMemoryLeaks(60000, 5);

// Büyük bir nesneyi temizle
const largeObject = { /* ... */ };
cleanupLargeObject(largeObject);

// İzlemeyi durdur
stopMonitoring();
stopDetecting();
```

## Asenkron İşlem Optimizasyonu

Asenkron işlem optimizasyonu araçları, `src/utils/asyncOptimizer.ts` dosyasında bulunur ve asenkron işlemleri optimize etmek için kullanılır.

### Asenkron İşlem Optimizasyonu

```typescript
import { 
  withTimeout, 
  withRetry, 
  withTimeoutAndRetry, 
  parallelLimit, 
  sequential, 
  memoizeAsync 
} from '../utils/asyncOptimizer';

// Zaman aşımı ile işlem
const result = await withTimeout(
  fetchData(),
  5000,
  'Veri getirme zaman aşımına uğradı'
);

// Yeniden deneme ile işlem
const result = await withRetry(
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
const result = await withTimeoutAndRetry(
  fetchData,
  {
    timeout: 5000,
    retries: 3,
    retryDelay: 1000
  }
);

// Paralel işlemler (maksimum 5 eşzamanlı işlem)
const results = await parallelLimit(
  [
    () => fetchUser(1),
    () => fetchUser(2),
    () => fetchUser(3),
    // ...
  ],
  5
);

// Sıralı işlemler
const results = await sequential([
  () => step1(),
  () => step2(),
  () => step3()
]);

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

## Veritabanı Optimizasyonu

Veritabanı optimizasyonu araçları, `src/utils/db-helpers.ts` ve `src/utils/queryOptimizer.ts` dosyalarında bulunur ve veritabanı sorgularını optimize etmek için kullanılır.

### Sorgu Optimizasyonu

```typescript
import { 
  paginateQuery, 
  optimizeQuery, 
  batchItems, 
  processBatch 
} from '../utils/db-helpers';

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

## Performans İzleme Middleware'leri

Performans izleme middleware'leri, `src/middleware/performanceMiddleware.ts` dosyasında bulunur ve HTTP isteklerinin performansını izlemek için kullanılır.

### Performans İzleme Middleware'leri

```typescript
import {
  requestDuration,
  memoryUsageMonitor,
  cpuUsageMonitor,
  largeResponseMonitor,
  performanceMonitoring
} from '../middleware/performanceMiddleware';

// Express uygulamasına middleware'leri ekle
app.use(requestDuration);
app.use(memoryUsageMonitor);
app.use(cpuUsageMonitor);
app.use(largeResponseMonitor);

// veya tüm performans middleware'lerini birleştiren fonksiyon
app.use(performanceMonitoring);
```

### Performans İzleme Middleware'lerinin Çalışma Şekli

1. **requestDuration**: İstek süresini ölçer ve loglar. 500ms'den uzun süren istekler için uyarı loglar.
2. **memoryUsageMonitor**: Bellek kullanımını izler ve her 100 istekte bir loglar.
3. **cpuUsageMonitor**: CPU kullanımını izler ve yüksek CPU kullanımı için uyarı loglar.
4. **largeResponseMonitor**: Büyük yanıtları (1MB'den büyük) tespit eder ve uyarı loglar.
5. **performanceMonitoring**: Tüm performans middleware'lerini birleştirir.
