# Güvenlik Kılavuzu

Bu dokümantasyon, uygulamanın güvenlik özellikleri ve en iyi uygulamaları hakkında bilgi sağlar.

## İçindekiler

1. [Güvenlik Araçları](#güvenlik-araçları)
2. [Kimlik Doğrulama ve Yetkilendirme](#kimlik-doğrulama-ve-yetkilendirme)
3. [Veri Doğrulama ve Sanitizasyon](#veri-doğrulama-ve-sanitizasyon)
4. [Güvenli HTTP Başlıkları](#güvenli-http-başlıkları)
5. [Rate Limiting](#rate-limiting)
6. [Güvenlik Taraması](#güvenlik-taraması)
7. [Şifreleme ve Veri Koruma](#şifreleme-ve-veri-koruma)
8. [Güvenlik Kontrol Listesi](#güvenlik-kontrol-listesi)

## Güvenlik Araçları

Uygulamada güvenlik için kullanılan temel araçlar:

- `src/utils/securityUtils.ts`: Güvenlik ile ilgili yardımcı fonksiyonlar
- `src/middleware/securityMiddleware.ts`: Güvenlik middleware'leri
- `scripts/security-scan.js`: Güvenlik taraması scripti

## Kimlik Doğrulama ve Yetkilendirme

### JWT Kimlik Doğrulama

```typescript
import { generateSecureToken, hmacSign } from '../utils/securityUtils';
import jwt from 'jsonwebtoken';

// JWT token oluştur
function generateToken(user) {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role
  };
  
  const secret = process.env.JWT_SECRET || generateSecureToken(32);
  const options = {
    expiresIn: '1h' // 1 saat geçerli
  };
  
  return jwt.sign(payload, secret, options);
}

// Token doğrula
function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Geçersiz token');
  }
}
```

### Rol Tabanlı Erişim Kontrolü

```typescript
import { ForbiddenError } from '../utils/errors';

// Rol tabanlı erişim kontrolü middleware'i
function requireRole(roles) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return next(new Error('Kimlik doğrulama gerekli'));
    }
    
    if (Array.isArray(roles) && !roles.includes(user.role)) {
      return next(new ForbiddenError('Bu işlem için yetkiniz yok'));
    }
    
    next();
  };
}

// Kullanım
app.get('/admin/users', requireRole(['admin']), (req, res) => {
  // Sadece admin rolüne sahip kullanıcılar erişebilir
});
```

## Veri Doğrulama ve Sanitizasyon

### Giriş Doğrulama

```typescript
import { ValidationError } from '../utils/errors';
import Joi from 'joi';

// Kullanıcı girişi doğrulama şeması
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required()
});

// Doğrulama middleware'i
function validateLogin(req, res, next) {
  const { error } = loginSchema.validate(req.body);
  
  if (error) {
    return next(new ValidationError(error.details[0].message));
  }
  
  next();
}
```

### XSS Koruması

```typescript
import { escapeHtml, sanitizeXss } from '../utils/securityUtils';

// HTML içeriğini temizle
function sanitizeContent(content) {
  return sanitizeXss(content);
}

// Kullanıcı girdisini escape et
function escapeUserInput(input) {
  return escapeHtml(input);
}
```

### SQL Enjeksiyon Koruması

```typescript
import { sanitizeSql } from '../utils/securityUtils';

// SQL sorgusunu temizle
function sanitizeQuery(query) {
  return sanitizeSql(query);
}
```

## Güvenli HTTP Başlıkları

```typescript
import { securityHeaders } from '../middleware/securityMiddleware';

// Tüm güvenlik başlıklarını uygula
app.use(securityHeaders);
```

Uygulanan başlıklar:

- Content-Security-Policy
- X-XSS-Protection
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security
- Referrer-Policy
- Feature-Policy

## Rate Limiting

```typescript
import { apiLimiter, authLimiter } from '../middleware/securityMiddleware';

// Genel API rate limiting
app.use('/api/', apiLimiter);

// Kimlik doğrulama için rate limiting
app.use('/api/auth/', authLimiter);
```

## Güvenlik Taraması

Güvenlik taraması yapmak için:

```bash
node scripts/security-scan.js
```

Bu script:

1. Bağımlılıkları güvenlik açıkları için tarar
2. Kod tabanını güvenlik sorunları için tarar
3. Güvenlik iyileştirme önerileri sunar

## Şifreleme ve Veri Koruma

### Veri Şifreleme

```typescript
import { encrypt, decrypt } from '../utils/securityUtils';

// Hassas veriyi şifrele
function encryptSensitiveData(data, key) {
  return encrypt(data, key);
}

// Şifrelenmiş veriyi çöz
function decryptSensitiveData(encrypted, key, iv) {
  return decrypt(encrypted, key, iv);
}
```

### Şifre Hashleme

```typescript
import bcrypt from 'bcrypt';

// Şifreyi hashle
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Şifreyi doğrula
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

### Güvenli Token Oluşturma

```typescript
import { generateSecureToken } from '../utils/securityUtils';

// Güvenli token oluştur
function generateResetToken() {
  return generateSecureToken(32);
}

// CSRF token oluştur
function generateCsrfToken(sessionId, secret) {
  return generateCsrfToken(sessionId, secret);
}
```

## Güvenlik Kontrol Listesi

- [ ] Tüm kullanıcı girdileri doğrulanıyor ve sanitize ediliyor
- [ ] Kimlik doğrulama ve yetkilendirme tüm korumalı rotalarda uygulanıyor
- [ ] Güvenli HTTP başlıkları ayarlanmış
- [ ] Rate limiting uygulanmış
- [ ] Şifreler güvenli bir şekilde hashlenmiş
- [ ] Hassas veriler şifrelenmiş
- [ ] HTTPS kullanılıyor
- [ ] Güvenlik güncellemeleri düzenli olarak uygulanıyor
- [ ] Güvenlik taramaları düzenli olarak yapılıyor
- [ ] Hata mesajları hassas bilgileri açığa çıkarmıyor
- [ ] Dosya yüklemeleri güvenli bir şekilde işleniyor
- [ ] Oturum yönetimi güvenli bir şekilde uygulanmış
- [ ] CSRF koruması uygulanmış
- [ ] XSS koruması uygulanmış
- [ ] SQL enjeksiyon koruması uygulanmış
- [ ] Komut enjeksiyon koruması uygulanmış
