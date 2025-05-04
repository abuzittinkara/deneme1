# TypeScript Geçiş Yol Haritası

Bu belge, projenin JavaScript'ten TypeScript'e kademeli geçiş sürecini planlamak için oluşturulmuştur.

## Geçiş Stratejisi

Projeyi JavaScript'ten TypeScript'e geçirirken aşağıdaki stratejik yaklaşımı izleyeceğiz:

1. **Bağımsız Modüllerden Başlama**: Önce diğer modüllere bağımlılığı az olan yardımcı modüllerden başlayacağız.
2. **Kademeli Geçiş**: Her seferinde bir veya birkaç modülü dönüştüreceğiz ve uygulamanın çalışır durumda kalmasını sağlayacağız.
3. **Tip Tanımlamalarını Aşamalı Olarak Ekleme**: Önce basit tip tanımlamaları ekleyip, daha sonra karmaşık tipleri ekleyeceğiz.
4. **Test Odaklı Yaklaşım**: Her dönüşümden sonra testler çalıştırarak işlevselliğin korunduğunu doğrulayacağız.

## Geçiş Sırası

Aşağıdaki sırayla modülleri TypeScript'e dönüştüreceğiz:

### 1. Yardımcı Modüller ve Altyapı
- [x] `src/config/env.ts` (Çevresel değişkenler)
- [x] `src/utils/logger.ts` (Loglama modülü)
- [x] `src/middleware/errorHandler.ts` (Hata işleme modülü)
- [x] `src/config/database.ts` (Veritabanı bağlantı modülü)
- [x] `src/config/redis.ts` (Redis bağlantı modülü)

### 2. Middleware Modülleri
- [x] `src/middleware/errorHandler.ts` (Zaten tamamlandı)
- [x] `src/middleware/security.ts` (Zaten tamamlandı)
- [x] `src/middleware/rateLimit.ts` (Zaten tamamlandı)
- [x] `src/middleware/sentryHandler.ts` (Zaten tamamlandı)

### 3. Modeller
- [x] `src/models/*.ts` (Zaten tamamlandı)

### 4. Temel İş Mantığı Modülleri
- [x] `src/modules/userManager.ts` (Zaten tamamlandı)
- [x] `src/modules/groupManager.ts` (Zaten tamamlandı)
- [x] `src/modules/channelManager.ts` (Zaten tamamlandı)
- [x] `src/modules/message/messageManager.ts` (Zaten tamamlandı)

### 5. Diğer İş Mantığı Modülleri
- [x] `src/modules/archiveManager.ts` (Zaten tamamlandı)
- [x] `src/modules/categoryManager.ts` (Zaten tamamlandı)
- [x] `src/modules/dmManager.ts` (Zaten tamamlandı)
- [x] `src/modules/fileUpload.ts` (Zaten tamamlandı)
- [x] `src/modules/invitationManager.ts` (Zaten tamamlandı)
- [x] `src/modules/mediaProcessor.ts` (Zaten tamamlandı)
- [x] `src/modules/notificationManager.ts` (Zaten tamamlandı)
- [x] `src/modules/profileManager.ts` (Zaten tamamlandı)
- [x] `src/modules/reportManager.ts` (Zaten tamamlandı)
- [x] `src/modules/richTextFormatter.ts` (Zaten tamamlandı)
- [x] `src/modules/roleManager.ts` (Zaten tamamlandı)
- [x] `src/modules/scheduledMessageManager.ts` (Zaten tamamlandı)
- [x] `src/modules/searchManager.ts` (Zaten tamamlandı)
- [x] `src/modules/statisticsManager.ts` (Zaten tamamlandı)
- [x] `src/modules/webhookManager.ts` (Zaten tamamlandı)

### 6. Kimlik Doğrulama ve Güvenlik Modülleri
- [x] `src/modules/auth/authManager.ts` (Zaten tamamlandı)
- [x] `src/modules/emailVerification.ts` (Zaten tamamlandı)
- [x] `src/modules/passwordReset.ts` (Zaten tamamlandı)
- [x] `src/modules/twoFactorAuth.ts` (Zaten tamamlandı)

### 7. Socket ve API Rotaları
- [x] `src/socket/socketEvents.ts` (Zaten tamamlandı)
- [x] `src/routes/*.ts` (Zaten tamamlandı)

### 8. Ana Uygulama Dosyaları
- [x] `src/sfu.ts` (SFU modülü)
- [x] `src/app.ts` (Ana uygulama dosyası)

## Tip Tanımlamaları

Aşağıdaki tip tanımlamalarını oluşturacağız:

1. **Temel Tipler**
   - [x] `src/types/common.ts` (Genel tipler)
   - [x] `src/types/api.ts` (API istek/yanıt tipleri)
   - [x] `src/types/socket.ts` (Socket.IO olay tipleri)

2. **Model Tipleri**
   - [x] `src/types/models.ts` (Mongoose model tipleri)

3. **Modül Tipleri**
   - [x] `src/types/modules.ts` (Modül fonksiyon ve parametre tipleri)

## Dönüşüm Komutları

Bir JavaScript dosyasını TypeScript'e dönüştürmek için:

```bash
npm run ts:convert <dosya_veya_dizin_yolu>
```

Örnek:
```bash
npm run ts:convert src/utils/logger.js
npm run ts:convert src/utils
```

Tip kontrolü yapmak için:
```bash
npm run ts:check
```

TypeScript dosyalarını derlemek için:
```bash
npm run build
```

## İlerleme Takibi

- Başlangıç Tarihi: 2023-06-15
- Güncelleme Tarihi: 2025-04-20
- Tamamlanan Modüller: 41/41
- Genel İlerleme: %100

## Notlar

- Her dönüşümden sonra uygulamayı test edin.
- Tip hatalarını kademeli olarak düzeltin.
- Karmaşık modülleri daha küçük parçalara bölmeyi düşünün.
- Mongoose modelleri için tip tanımlamalarını dikkatli bir şekilde oluşturun.
