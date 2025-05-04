# Performans İzleme API

Bu dokümantasyon, performans izleme API endpoint'lerini açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Performans Raporu](#performans-raporu)
3. [Performans Ölçümleri](#performans-ölçümleri)
4. [Bellek Kullanımı](#bellek-kullanımı)
5. [Çöp Toplama](#çöp-toplama)

## Giriş

Performans izleme API, uygulamanın performansını izlemek ve optimize etmek için kullanılır. Bu API, sadece admin rolüne sahip kullanıcılar tarafından erişilebilir.

## Performans Raporu

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

## Performans Ölçümleri

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

## Bellek Kullanımı

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

## Çöp Toplama

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

**Hata Yanıtı:**

```json
{
  "success": false,
  "error": {
    "message": "Çöp toplama işlemi zorlanamıyor. Node.js'i --expose-gc parametresi ile başlatın",
    "type": "BadRequestError"
  }
}
```

## Kullanım Örnekleri

### Performans Raporu Alma

```javascript
async function getPerformanceReport() {
  try {
    const response = await fetch('/api/performance/report', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Performans raporu:', data.data);
    } else {
      console.error('Hata:', data.error);
    }
  } catch (error) {
    console.error('İstek hatası:', error);
  }
}
```

### Bellek Kullanımını İzleme

```javascript
async function monitorMemoryUsage() {
  try {
    const response = await fetch('/api/performance/memory', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Bellek kullanımı:', data.data.formatted);
    } else {
      console.error('Hata:', data.error);
    }
  } catch (error) {
    console.error('İstek hatası:', error);
  }
}
```

### Çöp Toplama İşlemini Zorla

```javascript
async function forceGarbageCollection() {
  try {
    const response = await fetch('/api/performance/gc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Çöp toplama sonucu:', data.data);
    } else {
      console.error('Hata:', data.error);
    }
  } catch (error) {
    console.error('İstek hatası:', error);
  }
}
```
