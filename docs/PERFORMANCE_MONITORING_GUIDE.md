# Performans İzleme Kılavuzu

Bu dokümantasyon, uygulamanın performansını izlemek ve optimize etmek için kullanılan araçları ve teknikleri açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Performans İzleme Araçları](#performans-i̇zleme-araçları)
3. [Performans İzleme API](#performans-i̇zleme-api)
4. [Performans Darboğazlarını Tespit Etme](#performans-darboğazlarını-tespit-etme)
5. [Performans Optimizasyon Teknikleri](#performans-optimizasyon-teknikleri)
6. [Performans İzleme Dashboard'u](#performans-i̇zleme-dashboardu)

## Giriş

Performans izleme, uygulamanın performansını izlemek ve optimize etmek için kullanılan bir süreçtir. Bu süreç, aşağıdaki adımları içerir:

1. **Performans Ölçümü**: Uygulamanın performansını ölçmek için kullanılan araçlar ve teknikler.
2. **Performans Analizi**: Ölçüm sonuçlarını analiz ederek darboğazları tespit etme.
3. **Performans Optimizasyonu**: Darboğazları gidermek için yapılan iyileştirmeler.
4. **Performans İzleme**: Optimizasyon sonuçlarını izleme ve değerlendirme.

## Performans İzleme Araçları

Uygulamanın performansını izlemek için aşağıdaki araçlar kullanılır:

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
```

### Bellek Kullanımı İzleme

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
```

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

## Performans İzleme API

Performans izleme API, uygulamanın performansını izlemek için kullanılan API endpoint'lerini içerir. Bu API, sadece admin rolüne sahip kullanıcılar tarafından erişilebilir.

### Performans Raporu

```
GET /api/performance/report
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "timestamp": "2023-06-15T14:30:00Z",
    "operations": [
      {
        "name": "fetchUserData",
        "count": 150,
        "averageDuration": 45.32,
        "minDuration": 12.45,
        "maxDuration": 120.78,
        "last24HoursCount": 75
      },
      {
        "name": "saveMessage",
        "count": 320,
        "averageDuration": 35.67,
        "minDuration": 10.23,
        "maxDuration": 95.45,
        "last24HoursCount": 120
      }
    ],
    "memory": {
      "rss": 123456789,
      "heapTotal": 87654321,
      "heapUsed": 54321678,
      "external": 12345678
    },
    "measurements": {
      "total": 470,
      "maxStored": 100
    }
  }
}
```

### Performans Ölçümleri

```
GET /api/performance/measurements
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sorgu Parametreleri:**

- `limit`: Maksimum ölçüm sayısı (varsayılan: 100)

**Yanıt:**

```json
{
  "success": true,
  "data": [
    {
      "name": "fetchUserData",
      "duration": 45.32,
      "metadata": {
        "userId": "60a1b2c3d4e5f6g7h8i9j0k1"
      },
      "timestamp": 1623766200000
    },
    {
      "name": "saveMessage",
      "duration": 35.67,
      "metadata": {
        "channelId": "80a1b2c3d4e5f6g7h8i9j0k1"
      },
      "timestamp": 1623766210000
    }
  ]
}
```

### Bellek Kullanımı

```
GET /api/performance/memory
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "raw": {
      "rss": 123456789,
      "heapTotal": 87654321,
      "heapUsed": 54321678,
      "external": 12345678,
      "arrayBuffers": 1234567
    },
    "formatted": {
      "rss": "117.74 MB",
      "heapTotal": "83.59 MB",
      "heapUsed": "51.81 MB",
      "external": "11.77 MB",
      "arrayBuffers": "1.18 MB"
    }
  }
}
```

### Çöp Toplama

```
POST /api/performance/gc
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "before": {
      "heapTotal": "83.59 MB",
      "heapUsed": "51.81 MB"
    },
    "after": {
      "heapTotal": "83.59 MB",
      "heapUsed": "45.23 MB"
    },
    "gain": {
      "heapTotal": "0.00 MB",
      "heapUsed": "6.58 MB"
    }
  }
}
```

## Performans Darboğazlarını Tespit Etme

Performans darboğazlarını tespit etmek için aşağıdaki adımları izleyin:

1. **Performans Raporu İnceleme**: Performans raporunu inceleyerek en yavaş işlemleri tespit edin.
2. **Bellek Kullanımı İnceleme**: Bellek kullanımını inceleyerek bellek sızıntılarını tespit edin.
3. **CPU Kullanımı İnceleme**: CPU kullanımını inceleyerek CPU yoğun işlemleri tespit edin.
4. **Ağ İstekleri İnceleme**: Ağ isteklerini inceleyerek yavaş API çağrılarını tespit edin.
5. **Veritabanı Sorguları İnceleme**: Veritabanı sorgularını inceleyerek yavaş sorguları tespit edin.

### Yavaş İşlemleri Tespit Etme

```typescript
// Son ölçümleri getir
const measurements = getRecentMeasurements();

// Ölçümleri süreye göre sırala
const sortedMeasurements = measurements.sort((a, b) => b.duration - a.duration);

// En yavaş 10 işlemi göster
console.log('En yavaş 10 işlem:');
sortedMeasurements.slice(0, 10).forEach((m, i) => {
  console.log(`${i + 1}. ${m.name}: ${m.duration.toFixed(2)}ms`);
});
```

### Bellek Sızıntılarını Tespit Etme

```typescript
// Bellek sızıntılarını tespit et
const stopDetecting = detectMemoryLeaks(60000, 5);

// Bellek kullanımını izle
const stopMonitoring = monitorMemoryUsage(1024, 60000);
```

## Performans Optimizasyon Teknikleri

Performans darboğazlarını gidermek için aşağıdaki teknikleri kullanabilirsiniz:

### Veritabanı Optimizasyonu

```typescript
// Sorgu optimizasyonu
const user = await optimizeQuery(
  User.findById(userId),
  {
    select: 'username email name',
    populate: 'groups',
    lean: true,
    timeout: 5000
  }
).exec();

// Toplu işlem
const results = await processBatch(
  users,
  async (batch) => {
    return Promise.all(batch.map(user => updateUser(user)));
  },
  100
);
```

### Bellek Optimizasyonu

```typescript
// Büyük nesneleri temizle
const largeObject = { /* ... */ };
cleanupLargeObject(largeObject);

// Çöp toplama işlemini zorla
if (global.gc) {
  global.gc();
}
```

### Asenkron İşlem Optimizasyonu

```typescript
// Paralel işlemler
const results = await parallelLimit(
  [
    () => fetchUser(1),
    () => fetchUser(2),
    () => fetchUser(3),
    // ...
  ],
  5
);

// Önbellekleme
const fetchUserMemoized = memoizeAsync(
  fetchUser,
  (id) => `user:${id}`,
  60000 // 1 dakika önbellek süresi
);
```

## Performans İzleme Dashboard'u

Performans izleme dashboard'u, uygulamanın performansını izlemek için kullanılan bir arayüzdür. Bu dashboard, aşağıdaki bilgileri içerir:

1. **Performans Metrikleri**: İşlem süreleri, bellek kullanımı, CPU kullanımı, vb.
2. **Performans Grafikleri**: Performans metriklerinin zaman içindeki değişimini gösteren grafikler.
3. **Performans Alarmları**: Performans metriklerinin belirli eşik değerlerini aştığında tetiklenen alarmlar.
4. **Performans Raporları**: Performans metriklerinin belirli zaman aralıklarındaki özetini gösteren raporlar.

### Dashboard Kurulumu

Performans izleme dashboard'unu kurmak için aşağıdaki adımları izleyin:

1. **Grafana Kurulumu**: Grafana'yı kurun ve yapılandırın.
2. **Prometheus Kurulumu**: Prometheus'u kurun ve yapılandırın.
3. **Node Exporter Kurulumu**: Node Exporter'ı kurun ve yapılandırın.
4. **Dashboard Yapılandırması**: Grafana dashboard'unu yapılandırın.

### Dashboard Kullanımı

Performans izleme dashboard'unu kullanmak için aşağıdaki adımları izleyin:

1. **Dashboard'a Erişim**: Grafana dashboard'una erişin.
2. **Performans Metriklerini İnceleme**: Performans metriklerini inceleyin.
3. **Performans Grafiklerini İnceleme**: Performans grafiklerini inceleyin.
4. **Performans Alarmlarını İnceleme**: Performans alarmlarını inceleyin.
5. **Performans Raporlarını İnceleme**: Performans raporlarını inceleyin.
