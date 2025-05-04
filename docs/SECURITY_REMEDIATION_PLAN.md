# Güvenlik İyileştirme Planı

Bu dokümantasyon, güvenlik taraması sonucunda tespit edilen sorunları çözmek için bir plan sunar.

## İçindekiler

1. [Tespit Edilen Sorunlar](#tespit-edilen-sorunlar)
2. [Öncelikli İyileştirmeler](#öncelikli-i̇yileştirmeler)
3. [Orta Vadeli İyileştirmeler](#orta-vadeli-i̇yileştirmeler)
4. [Uzun Vadeli İyileştirmeler](#uzun-vadeli-i̇yileştirmeler)
5. [İyileştirme Takibi](#i̇yileştirme-takibi)

## Tespit Edilen Sorunlar

Güvenlik taraması sonucunda aşağıdaki sorunlar tespit edilmiştir:

1. **Hardcoded Credentials (464 adet)**: Kodda sabit olarak tanımlanmış kimlik bilgileri, API anahtarları, token'lar ve şifreler.
2. **Cross-Site Scripting (XSS) (300+ adet)**: `innerHTML` kullanımı nedeniyle XSS saldırılarına açık kod parçaları.
3. **Insecure Direct Object Reference (80 adet)**: Kullanıcı girdilerine dayalı doğrudan nesne referansları.
4. **Insecure File Operations (5 adet)**: Güvenli olmayan dosya işlemleri.
5. **Potential RegExp DoS (2 adet)**: Düzenli ifadelerde potansiyel DoS (Denial of Service) açıkları.
6. **Insecure Randomness (11 adet)**: Güvenlik gerektiren işlemlerde `Math.random()` kullanımı.

## Öncelikli İyileştirmeler

Aşağıdaki iyileştirmeler hemen uygulanmalıdır:

### 1. Hardcoded Credentials Sorunlarını Çözme

**Sorun**: Kodda sabit olarak tanımlanmış kimlik bilgileri, API anahtarları, token'lar ve şifreler.

**Çözüm**:

1. Tüm sabit kimlik bilgilerini, API anahtarlarını ve token'ları çevre değişkenlerine taşıyın.
2. `.env` dosyasını güncelleyin ve `.env.example` dosyası oluşturun.
3. Hassas bilgileri içeren dosyaları `.gitignore` dosyasına ekleyin.

**Örnek**:

```typescript
// YANLIŞ
const API_KEY = 'abcdef123456';

// DOĞRU
const API_KEY = process.env.API_KEY;
```

**Dosyalar**:

- `src/config/env.ts`
- `.env`
- `.env.example`
- `.gitignore`

### 2. Cross-Site Scripting (XSS) Sorunlarını Çözme

**Sorun**: `innerHTML` kullanımı nedeniyle XSS saldırılarına açık kod parçaları.

**Çözüm**:

1. `innerHTML` kullanımlarını gözden geçirin ve mümkünse `textContent` ile değiştirin.
2. Kullanıcı girdilerini işleyen kodlarda DOMPurify gibi bir kütüphane kullanarak sanitizasyon uygulayın.
3. Content Security Policy (CSP) başlıklarını sıkılaştırın.

**Örnek**:

```typescript
// YANLIŞ
element.innerHTML = userInput;

// DOĞRU
import DOMPurify from 'dompurify';
element.textContent = userInput; // veya
element.innerHTML = DOMPurify.sanitize(userInput);
```

**Dosyalar**:

- `src/utils/sanitizer.ts`
- `src/middleware/securityMiddleware.ts`

### 3. Insecure Direct Object Reference Sorunlarını Çözme

**Sorun**: Kullanıcı girdilerine dayalı doğrudan nesne referansları.

**Çözüm**:

1. Tüm API endpoint'lerinde yetki kontrolü uygulayın.
2. Kullanıcı girdilerini doğrulayın ve sanitize edin.
3. Nesne düzeyinde erişim kontrolü uygulayın.

**Örnek**:

```typescript
// YANLIŞ
const userId = req.params.id;
const user = await User.findById(userId);

// DOĞRU
const userId = req.params.id;
const currentUser = req.user;

// Yetki kontrolü
if (currentUser.role !== 'admin' && currentUser.id !== userId) {
  throw new ForbiddenError('Bu işlem için yetkiniz yok');
}

const user = await User.findById(userId);
```

**Dosyalar**:

- `src/utils/authorizationHelper.ts`
- `src/middleware/authorizationMiddleware.ts`
- `src/routes/api/*.ts`

## Orta Vadeli İyileştirmeler

Aşağıdaki iyileştirmeler orta vadede uygulanmalıdır:

### 1. Insecure File Operations Sorunlarını Çözme

**Sorun**: Güvenli olmayan dosya işlemleri.

**Çözüm**:

1. Dosya işlemlerinde path traversal saldırılarına karşı koruma uygulayın.
2. Dosya izinlerini sıkılaştırın.
3. Dosya işlemlerini asenkron olarak gerçekleştirin.

**Örnek**:

```typescript
// YANLIŞ
fs.writeFileSync(filePath, content);

// DOĞRU
const safeFilePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
await fs.promises.writeFile(safeFilePath, content, { mode: 0o644 });
```

**Dosyalar**:

- `src/utils/fileUtils.ts`
- `src/controllers/uploadController.ts`

### 2. Potential RegExp DoS Sorunlarını Çözme

**Sorun**: Düzenli ifadelerde potansiyel DoS (Denial of Service) açıkları.

**Çözüm**:

1. Kullanıcı girdilerine dayalı düzenli ifadeleri güvenli hale getirin.
2. Düzenli ifadelerde zaman aşımı mekanizması uygulayın.
3. Karmaşık düzenli ifadeleri test edin ve optimize edin.

**Örnek**:

```typescript
// YANLIŞ
const regex = new RegExp(userInput);

// DOĞRU
const regex = new RegExp(escapeRegExp(userInput));
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Dosyalar**:

- `src/utils/regexUtils.ts`
- `src/utils/validationUtils.ts`

## Uzun Vadeli İyileştirmeler

Aşağıdaki iyileştirmeler uzun vadede uygulanmalıdır:

### 1. Insecure Randomness Sorunlarını Çözme

**Sorun**: Güvenlik gerektiren işlemlerde `Math.random()` kullanımı.

**Çözüm**:

1. Güvenlik gerektiren işlemlerde `Math.random()` yerine `crypto.randomBytes()` kullanın.
2. Rastgele değer üreten fonksiyonları merkezi bir yerde toplayın.
3. Rastgele değerlerin entropisi ve kalitesini test edin.

**Örnek**:

```typescript
// YANLIŞ
const randomValue = Math.random();

// DOĞRU
import crypto from 'crypto';
const randomValue = crypto.randomBytes(16).toString('hex');
```

**Dosyalar**:

- `src/utils/securityUtils.ts`
- `src/utils/cryptoUtils.ts`

### 2. Güvenlik Taraması Otomasyonu

**Çözüm**:

1. Güvenlik taramasını CI/CD süreçlerine entegre edin.
2. Düzenli güvenlik taramaları yapın ve sonuçları raporlayın.
3. Güvenlik açıklarını otomatik olarak tespit eden ve raporlayan bir sistem kurun.

**Örnek**:

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # Her Pazar günü çalıştır

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm ci
      - name: Run security scan
        run: node scripts/security-scan.js
      - name: Upload security report
        uses: actions/upload-artifact@v2
        with:
          name: security-report
          path: security-report.json
```

## İyileştirme Takibi

Güvenlik iyileştirmelerinin takibi için aşağıdaki adımları izleyin:

1. **Sorun Takibi**: Tespit edilen güvenlik sorunlarını bir sorun takip sistemi (JIRA, GitHub Issues, vb.) üzerinde takip edin.
2. **Önceliklendirme**: Sorunları önem ve aciliyet durumuna göre önceliklendirin.
3. **Atama**: Sorunları çözecek kişileri belirleyin ve atayın.
4. **Zaman Çizelgesi**: Sorunların çözülmesi için bir zaman çizelgesi oluşturun.
5. **İlerleme Takibi**: İyileştirme çalışmalarının ilerlemesini düzenli olarak takip edin.
6. **Doğrulama**: İyileştirmelerin etkinliğini doğrulamak için güvenlik taramasını tekrarlayın.

### Öncelikli Sorunlar Listesi

| Sorun | Öncelik | Atanan | Durum | Tamamlanma Tarihi |
|-------|---------|--------|-------|-------------------|
| Hardcoded Credentials | Yüksek | | Bekliyor | |
| Cross-Site Scripting (XSS) | Yüksek | | Bekliyor | |
| Insecure Direct Object Reference | Yüksek | | Bekliyor | |
| Insecure File Operations | Orta | | Bekliyor | |
| Potential RegExp DoS | Orta | | Bekliyor | |
| Insecure Randomness | Düşük | | Bekliyor | |
