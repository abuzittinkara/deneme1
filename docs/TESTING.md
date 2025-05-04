# Test Kılavuzu

Bu dokümantasyon, projenin test stratejisini ve test süreçlerini açıklar.

## İçindekiler

1. [Test Stratejisi](#test-stratejisi)
2. [Birim Testleri](#birim-testleri)
3. [Entegrasyon Testleri](#entegrasyon-testleri)
4. [Uçtan Uca Testler](#uçtan-uca-testler)
5. [Performans Testleri](#performans-testleri)
6. [Test Ortamı Kurulumu](#test-ortamı-kurulumu)
7. [Test Kapsamını Artırma](#test-kapsamını-artırma)

## Test Stratejisi

Projemiz, aşağıdaki test seviyelerini içeren kapsamlı bir test stratejisi kullanır:

1. **Birim Testleri**: Bağımsız kod birimlerinin (fonksiyonlar, sınıflar) doğru çalıştığını doğrular.
2. **Entegrasyon Testleri**: Bileşenlerin birlikte doğru çalıştığını doğrular.
3. **Uçtan Uca Testler**: Kullanıcı senaryolarını simüle ederek sistemin bütününü test eder.
4. **Performans Testleri**: Sistemin performans gereksinimlerini karşıladığını doğrular.

## Birim Testleri

Birim testleri, Jest test çerçevesi kullanılarak yazılır ve çalıştırılır.

### Birim Testlerini Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Belirli bir test dosyasını çalıştır
npm test -- src/__tests__/utils/asyncOptimizer.test.ts

# Belirli bir test grubunu çalıştır
npm test -- --testPathPattern=utils

# Değişen dosyalara göre testleri çalıştır
npm test -- --watch
```

### Birim Test Örneği

```typescript
// src/__tests__/utils/asyncOptimizer.test.ts
import { withTimeout } from '../../utils/asyncOptimizer';

describe('AsyncOptimizer', () => {
  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        1000
      );
      
      expect(result).toBe('success');
    });
    
    it('should reject when promise takes longer than timeout', async () => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 500));
      
      await expect(
        withTimeout(slowPromise, 100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });
  });
});
```

### Mock Kullanımı

```typescript
// Fonksiyon mock'lama
const mockFn = jest.fn().mockReturnValue('mocked value');

// Modül mock'lama
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Zamanlayıcı mock'lama
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
jest.useRealTimers();
```

## Entegrasyon Testleri

Entegrasyon testleri, sistemin farklı bileşenlerinin birlikte doğru çalıştığını doğrular.

### Entegrasyon Testlerini Çalıştırma

```bash
# Entegrasyon testlerini çalıştır
npm run test:integration
```

### Entegrasyon Test Örneği

```typescript
// src/__tests__/integration/auth.test.ts
import request from 'supertest';
import { app } from '../../app';
import { User } from '../../models/User';

describe('Auth API', () => {
  beforeAll(async () => {
    // Test veritabanını kur
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    // Test veritabanını temizle
    await cleanupTestDatabase();
  });
  
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('token');
    
    // Veritabanında kullanıcının oluşturulduğunu doğrula
    const user = await User.findOne({ username: 'testuser' });
    expect(user).not.toBeNull();
  });
});
```

## Uçtan Uca Testler

Uçtan uca testler, kullanıcı senaryolarını simüle ederek sistemin bütününü test eder.

### Uçtan Uca Testleri Çalıştırma

```bash
# Uçtan uca testleri çalıştır
npm run test:e2e
```

### Uçtan Uca Test Örneği

```typescript
// tests/e2e/auth.test.ts
import { test, expect } from '@playwright/test';

test('User can register and login', async ({ page }) => {
  // Kayıt sayfasına git
  await page.goto('http://localhost:3000/register');
  
  // Kayıt formunu doldur
  await page.fill('input[name="username"]', 'e2euser');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'Password123!');
  await page.fill('input[name="confirmPassword"]', 'Password123!');
  
  // Kayıt ol
  await page.click('button[type="submit"]');
  
  // Ana sayfaya yönlendirildiğini doğrula
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
  
  // Çıkış yap
  await page.click('button.logout');
  
  // Giriş sayfasına git
  await page.goto('http://localhost:3000/login');
  
  // Giriş formunu doldur
  await page.fill('input[name="username"]', 'e2euser');
  await page.fill('input[name="password"]', 'Password123!');
  
  // Giriş yap
  await page.click('button[type="submit"]');
  
  // Ana sayfaya yönlendirildiğini doğrula
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
});
```

## Performans Testleri

Performans testleri, sistemin performans gereksinimlerini karşıladığını doğrular.

### Performans Testlerini Çalıştırma

```bash
# Performans testlerini çalıştır
npm run test:performance
```

### Performans Test Örneği

```typescript
// tests/performance/api.test.ts
import autocannon from 'autocannon';

async function runBenchmark() {
  const result = await autocannon({
    url: 'http://localhost:3000/api/users',
    connections: 100,
    duration: 10,
    headers: {
      'Authorization': 'Bearer YOUR_TEST_TOKEN'
    }
  });
  
  console.log('Requests per second:', result.requests.average);
  console.log('Latency (ms):', result.latency.average);
  
  // Performans kriterlerini doğrula
  if (result.requests.average < 1000) {
    throw new Error('Performance criteria not met: RPS too low');
  }
  
  if (result.latency.average > 50) {
    throw new Error('Performance criteria not met: Latency too high');
  }
}

runBenchmark().catch(console.error);
```

## Test Ortamı Kurulumu

### Jest Yapılandırması

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/types/**',
    '!src/paths.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};
```

### Test Kurulum Dosyası

```typescript
// src/__tests__/setup.ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

// Jest zaman aşımını artır
jest.setTimeout(30000);

// Ortam değişkenlerini ayarla
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Global kurulum
beforeAll(async () => {
  // Bellek içi MongoDB sunucusu başlat
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // MongoDB'ye bağlan
  await mongoose.connect(mongoUri);
  
  console.log(`MongoDB bellek sunucusu başlatıldı: ${mongoUri}`);
});

// Global temizleme
afterAll(async () => {
  // MongoDB bağlantısını kapat
  await mongoose.disconnect();
  
  // Bellek içi MongoDB sunucusunu durdur
  await mongoServer.stop();
  
  console.log('MongoDB bellek sunucusu durduruldu');
});

// Her testten sonra koleksiyonları temizle
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
```

## Test Kapsamını Artırma

Test kapsamını artırmak için aşağıdaki adımları izleyin:

1. **Eksik Testleri Belirleyin**: Test kapsamı raporunu çalıştırarak eksik testleri belirleyin.

```bash
npm test -- --coverage
```

2. **Öncelikli Alanları Belirleyin**: Kritik iş mantığı, hata işleme ve güvenlik ile ilgili kodlar için öncelikli olarak testler yazın.

3. **Test Şablonları Oluşturun**: Yaygın test senaryoları için şablonlar oluşturun ve bunları tutarlı bir şekilde kullanın.

4. **Test Otomasyonu Kurun**: CI/CD süreçlerine test otomasyonu ekleyin ve her değişiklikte testlerin çalıştırılmasını sağlayın.

5. **Test Güdümlü Geliştirme (TDD) Uygulayın**: Yeni özellikler eklerken önce testleri yazın, sonra kodu geliştirin.

### Yeni Birim Testleri Ekleme

Yeni eklenen yardımcı sınıflar için birim testleri ekleyin:

- `src/__tests__/utils/asyncOptimizer.test.ts`
- `src/__tests__/utils/memoryOptimizer.test.ts`
- `src/__tests__/utils/securityUtils.test.ts`
- `src/__tests__/middleware/performanceMiddleware.test.ts`
- `src/__tests__/middleware/securityMiddleware.test.ts`

### Entegrasyon Testleri Ekleme

Yeni API endpoint'leri ve işlevsellikler için entegrasyon testleri ekleyin:

- `src/__tests__/integration/api/users.test.ts`
- `src/__tests__/integration/api/messages.test.ts`
- `src/__tests__/integration/api/channels.test.ts`
- `src/__tests__/integration/api/groups.test.ts`

### Performans Testleri Ekleme

Kritik API endpoint'leri ve işlemler için performans testleri ekleyin:

- `tests/performance/api/users.test.ts`
- `tests/performance/api/messages.test.ts`
- `tests/performance/database.test.ts`
- `tests/performance/websocket.test.ts`
