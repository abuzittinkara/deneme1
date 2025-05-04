# Güvenlik İyileştirmeleri Uygulama Kılavuzu

Bu dokümantasyon, güvenlik iyileştirmelerinin nasıl uygulandığını ve kullanıldığını açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Sanitizasyon Araçları](#sanitizasyon-araçları)
3. [Yetkilendirme Sistemi](#yetkilendirme-sistemi)
4. [Güvenli Çevre Değişkenleri](#güvenli-çevre-değişkenleri)
5. [Güvenlik Taraması](#güvenlik-taraması)

## Giriş

Güvenlik iyileştirmeleri, aşağıdaki alanlarda yapılmıştır:

1. **Sanitizasyon Araçları**: Kullanıcı girdilerini temizlemek için yardımcı fonksiyonlar
2. **Yetkilendirme Sistemi**: Kaynaklara erişim yetkilerini kontrol etmek için yardımcı fonksiyonlar ve middleware'ler
3. **Güvenli Çevre Değişkenleri**: Hardcoded credentials sorunlarını çözmek için çevre değişkenleri yapılandırması
4. **Güvenlik Taraması**: Güvenlik sorunlarını tespit etmek için tarama scripti

## Sanitizasyon Araçları

Sanitizasyon araçları, `src/utils/sanitizer.ts` dosyasında bulunur ve kullanıcı girdilerini temizlemek için kullanılır.

### Kullanım Örnekleri

```typescript
import { 
  escapeHtml, 
  sanitizeXss, 
  sanitizeSql, 
  sanitizeUrl, 
  sanitizeFilename, 
  sanitizeAll 
} from '../utils/sanitizer';

// HTML karakterlerini escape et
const safeHtml = escapeHtml('<script>alert("XSS");</script>');
// Sonuç: &lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt;

// XSS saldırılarına karşı temizle
const safeText = sanitizeXss('<script>alert("XSS");</script>Hello');
// Sonuç: Hello

// SQL enjeksiyonlarına karşı temizle
const safeSql = sanitizeSql("Robert'); DROP TABLE Students;--");
// Sonuç: Robert''); DROP TABLE Students;--

// URL'yi sanitize et
const safeUrl = sanitizeUrl('javascript:alert("XSS")');
// Sonuç: '' (boş string)

// Dosya adını sanitize et
const safeFilename = sanitizeFilename('../../../etc/passwd');
// Sonuç: ___etc_passwd

// Tüm sanitizasyon fonksiyonlarını uygula
const safeInput = sanitizeAll('<script>alert("XSS");</script>Robert\'); DROP TABLE Students;--');
// Sonuç: Tüm tehlikeli karakterler temizlenmiş
```

### Express Validator ile Kullanım

```typescript
import { body, param } from 'express-validator';
import { sanitizeAll } from '../utils/sanitizer';

router.post(
  '/api/users',
  [
    body('username')
      .isString()
      .notEmpty()
      .withMessage('Geçersiz kullanıcı adı')
      .customSanitizer(value => sanitizeAll(value)),
    
    body('email')
      .isEmail()
      .withMessage('Geçersiz e-posta adresi')
      .customSanitizer(value => sanitizeAll(value))
  ],
  validateRequest,
  createUser
);
```

## Yetkilendirme Sistemi

Yetkilendirme sistemi, `src/utils/authorizationHelper.ts` ve `src/middleware/authorizationMiddleware.ts` dosyalarında bulunur ve kaynaklara erişim yetkilerini kontrol etmek için kullanılır.

### Yetkilendirme Yardımcı Fonksiyonları

```typescript
import { 
  hasPermission, 
  authorizeOrFail, 
  getUserIdFromRequest 
} from '../utils/authorizationHelper';

// Kullanıcının bir kaynağa erişim yetkisi olup olmadığını kontrol et
const hasAccess = await hasPermission(
  userId,
  resourceId,
  'group',
  'edit'
);

// Yetkilendirme kontrolü yap ve hata fırlat
await authorizeOrFail(
  userId,
  resourceId,
  'channel',
  'delete'
);

// İstek nesnesinden kullanıcı ID'sini al
const userId = getUserIdFromRequest(req);
```

### Yetkilendirme Middleware'leri

```typescript
import { 
  authorizeGroup, 
  authorizeChannel, 
  authorizeMessage, 
  authorizeUser, 
  requireAdmin, 
  requireModerator 
} from '../middleware/authorizationMiddleware';

// Grup erişim yetkisi kontrolü
router.put(
  '/api/groups/:id',
  requireAuth,
  authorizeGroup('edit'),
  updateGroup
);

// Kanal erişim yetkisi kontrolü
router.delete(
  '/api/channels/:id',
  requireAuth,
  authorizeChannel('delete'),
  deleteChannel
);

// Mesaj erişim yetkisi kontrolü
router.put(
  '/api/messages/:id',
  requireAuth,
  authorizeMessage('edit'),
  updateMessage
);

// Kullanıcı erişim yetkisi kontrolü
router.put(
  '/api/users/:id',
  requireAuth,
  authorizeUser('edit'),
  updateUser
);

// Admin rolü kontrolü
router.get(
  '/api/admin/users',
  requireAuth,
  requireAdmin(),
  getUsers
);

// Moderatör rolü kontrolü
router.get(
  '/api/reports',
  requireAuth,
  requireModerator(),
  getReports
);
```

## Güvenli Çevre Değişkenleri

Güvenli çevre değişkenleri, `src/config/env.ts` dosyasında bulunur ve hardcoded credentials sorunlarını çözmek için kullanılır.

### Çevre Değişkenleri Yapılandırması

```typescript
// src/config/env.ts
export const env = {
  // Uygulama ayarları
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '9092', 10),
  
  // JWT ayarları
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-jwt-secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // ...
};

// Üretim ortamında gerekli çevre değişkenlerini kontrol et
if (env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'EMAIL_USER',
    'EMAIL_PASSWORD'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Üretim ortamında ${envVar} çevre değişkeni gereklidir`);
    }
  }
}
```

### .env Dosyası

```
# .env
NODE_ENV=development
PORT=9092

# MongoDB ayarları
MONGODB_URI=mongodb://localhost:27017/fisqos

# JWT ayarları
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ...
```

## Güvenlik Taraması

Güvenlik taraması, `scripts/security-scan.js` dosyasında bulunur ve güvenlik sorunlarını tespit etmek için kullanılır.

### Güvenlik Taraması Çalıştırma

```bash
node scripts/security-scan.js
```

### Güvenlik Taraması Sonuçları

Güvenlik taraması, aşağıdaki sorunları tespit eder:

1. **Hardcoded Credentials**: Kodda sabit olarak tanımlanmış kimlik bilgileri, API anahtarları, token'lar ve şifreler.
2. **Cross-Site Scripting (XSS)**: `innerHTML` kullanımı nedeniyle XSS saldırılarına açık kod parçaları.
3. **Insecure Direct Object Reference**: Kullanıcı girdilerine dayalı doğrudan nesne referansları.
4. **Insecure File Operations**: Güvenli olmayan dosya işlemleri.
5. **Potential RegExp DoS**: Düzenli ifadelerde potansiyel DoS (Denial of Service) açıkları.
6. **Insecure Randomness**: Güvenlik gerektiren işlemlerde `Math.random()` kullanımı.

### Güvenlik İyileştirme Önerileri

Güvenlik taraması, aşağıdaki iyileştirme önerilerini sunar:

1. **Bağımlılıkları Güncelleme**: `npm audit fix --force` komutu ile bağımlılıkları güncelleyin.
2. **Kimlik Doğrulama ve Yetkilendirme**: JWT token'ları için kısa ömür ve yenileme mekanizması kullanın.
3. **Veri Doğrulama ve Sanitizasyon**: Tüm kullanıcı girdilerini doğrulayın ve sanitize edin.
4. **Güvenli HTTP Başlıkları**: Content-Security-Policy, X-XSS-Protection, X-Content-Type-Options, Strict-Transport-Security başlıklarını ayarlayın.
5. **Dosya Yükleme Güvenliği**: Dosya türü ve boyut kontrolü yapın, dosya içeriğini doğrulayın.
6. **Hata İşleme ve Loglama**: Hassas bilgileri loglara yazmaktan kaçının, kullanıcılara ayrıntılı hata mesajları göstermeyin.
7. **Şifreleme ve Veri Koruma**: Hassas verileri şifreleyin, HTTPS kullanın, güçlü şifreleme algoritmaları kullanın.
8. **API Güvenliği**: Rate limiting uygulayın, CORS politikalarını sıkılaştırın, API anahtarları ve token'lar için güvenli depolama kullanın.
