# Fisqos - Gerçek Zamanlı İletişim Platformu

Fisqos, Discord benzeri bir gerçek zamanlı iletişim platformudur. Kullanıcılar gruplar oluşturabilir, metin ve ses kanalları ekleyebilir, dosya paylaşabilir ve arkadaşlarıyla doğrudan mesajlaşabilir.

## Özellikler

- **Kullanıcı Yönetimi**: Kayıt, giriş, profil düzenleme
- **Grup Yönetimi**: Grup oluşturma, silme, yeniden adlandırma
- **Kanal Yönetimi**: Metin ve ses kanalları oluşturma
- **Gerçek Zamanlı Mesajlaşma**: Metin kanallarında ve DM'lerde mesajlaşma
- **Ses İletişimi**: WebRTC tabanlı ses iletişimi
- **Ekran Paylaşımı**: WebRTC ile ekran paylaşımı
- **Dosya Paylaşımı**: Metin kanallarında ve DM'lerde dosya paylaşımı
- **Mesaj Düzenleme/Silme**: Gönderilen mesajları düzenleme ve silme
- **Zengin Metin Desteği**: Markdown benzeri biçimlendirme ve emoji desteği
- **Arama**: Mesajlarda arama yapma
- **Arkadaşlık Sistemi**: Arkadaş ekleme, çıkarma, engelleme
- **Çoklu Dil Desteği**: Türkçe ve İngilizce dil desteği

## Teknolojiler

### Backend
- **Dil**: TypeScript/JavaScript
- **Çatı**: Node.js, Express
- **Veritabanı**: MongoDB (Mongoose)
- **Gerçek Zamanlı İletişim**: Socket.IO
- **Medya Akışı**: Mediasoup (WebRTC SFU)
- **API Dokümantasyonu**: Swagger/OpenAPI
- **Kimlik Doğrulama**: JWT (JSON Web Token)
- **Doğrulama**: Joi
- **Loglama**: Winston

### Frontend
- **Dil**: TypeScript/JavaScript
- **Çatı**: HTML, CSS, JavaScript
- **Gerçek Zamanlı İletişim**: Socket.IO Client
- **Medya İşleme**: WebRTC

### DevOps
- **Konteynerizasyon**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Dağıtım**: Render.com

## Proje Yapısı

```
fisqos/
├── .github/                # GitHub Actions workflow'ları
├── .vscode/                # VS Code ayarları
├── dist/                   # Derlenmiş TypeScript dosyaları (build sonrası)
├── logs/                   # Log dosyaları
├── node_modules/           # Node.js modülleri
├── public/                 # Statik dosyalar
│   ├── css/                # Stil dosyaları
│   ├── js/                 # İstemci tarafı JavaScript
│   ├── images/             # Resimler
│   └── index.html          # Ana HTML dosyası
├── scripts/                # Yardımcı scriptler
├── src/                    # TypeScript kaynak kodları
│   ├── __tests__/          # Test dosyaları
│   │   ├── integration/    # Entegrasyon testleri
│   │   ├── models/         # Model testleri
│   │   └── utils/          # Yardımcı fonksiyon testleri
│   ├── config/             # Yapılandırma dosyaları
│   │   ├── env.ts          # Çevre değişkenleri
│   │   ├── swagger.ts      # Swagger yapılandırması
│   │   └── database.ts     # Veritabanı yapılandırması
│   ├── controllers/        # API controller'ları
│   ├── middleware/         # Express middleware'leri
│   ├── models/             # Veritabanı modelleri
│   ├── routes/             # API rotaları
│   ├── services/           # İş mantığı servisleri
│   ├── sfu/                # Mediasoup SFU yapılandırması
│   ├── socket/             # Socket.IO işleyicileri
│   ├── types/              # TypeScript tip tanımları
│   ├── utils/              # Yardımcı fonksiyonlar
│   ├── validations/        # Doğrulama şemaları
│   ├── app.ts              # Express uygulaması
│   ├── server.ts           # HTTP sunucusu
│   └── index.ts            # Ana giriş noktası
├── uploads/                # Yüklenen dosyalar
├── .dockerignore           # Docker tarafından yok sayılacak dosyalar
├── .env.example            # Çevre değişkenleri şablonu
├── .eslintrc.js            # ESLint yapılandırması
├── .gitignore              # Git tarafından yok sayılacak dosyalar
├── .prettierrc             # Prettier yapılandırması
├── docker-compose.yml      # Docker Compose yapılandırması
├── Dockerfile              # Docker yapılandırması
├── jest.config.js          # Jest test yapılandırması
├── package.json            # Proje bağımlılıkları
├── Procfile                # Render.com için başlatma talimatları
├── README.md               # Proje dokümantasyonu
├── render.yaml             # Render.com yapılandırması
└── tsconfig.json           # TypeScript derleyici ayarları
```

## Kurulum

### Gereksinimler

- Node.js 18.x veya üzeri
- MongoDB 4.4 veya üzeri
- npm 8.x veya üzeri

### Yerel Geliştirme

1. Depoyu klonlayın:
   ```bash
   git clone https://github.com/kullanici/fisqos.git
   cd fisqos
   ```

2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```

3. Çevre değişkenlerini ayarlayın:
   ```bash
   cp .env.example .env
   # .env dosyasını düzenleyin
   ```

4. Geliştirme modunda sunucuyu başlatın:
   ```bash
   npm run dev
   ```

5. Testleri çalıştırın:
   ```bash
   npm test
   ```

6. Üretim için derleme yapın:
   ```bash
   npm run build
   ```

7. Üretim modunda sunucuyu başlatın:
   ```bash
   npm start
   ```

### Docker ile Kurulum

1. Docker ve Docker Compose'u yükleyin

2. Depoyu klonlayın:
   ```bash
   git clone https://github.com/kullanici/fisqos.git
   cd fisqos
   ```

3. Çevre değişkenlerini ayarlayın:
   ```bash
   cp .env.example .env
   # .env dosyasını düzenleyin
   ```

4. Docker Compose ile başlatın:
   ```bash
   docker-compose up -d
   ```

### Render.com Dağıtımı

1. GitHub deposunu Render.com'a bağlayın

2. Yeni bir Web Hizmeti oluşturun

3. Aşağıdaki ayarları yapılandırın:
   - Derleme Komutu: `npm ci && npm run build`
   - Başlatma Komutu: `npm start`
   - Çevre Değişkenleri:
     - `NODE_ENV`: production
     - `MONGODB_URI`: MongoDB bağlantı dizesi
     - `PORT`: 3000
     - `JWT_SECRET`: Güvenli bir rastgele dize
     - `JWT_EXPIRES_IN`: 1h
     - `JWT_REFRESH_SECRET`: Güvenli bir rastgele dize
     - `JWT_REFRESH_EXPIRES_IN`: 7d
     - `CORS_ORIGIN`: İstemci URL'si veya *

4. Dağıtımı başlatın

## API Dokümantasyonu

API dokümantasyonu Swagger UI ile sağlanmaktadır. Sunucu çalışırken aşağıdaki URL'den erişilebilir:

```
http://localhost:3000/api/docs
```

## Geliştirme

### TypeScript Geçişi

Proje, JavaScript'ten TypeScript'e geçiş sürecindedir. Yeni özellikler ve değişiklikler TypeScript ile geliştirilmelidir. Mevcut JavaScript dosyaları kademeli olarak TypeScript'e dönüştürülmektedir.

JavaScript dosyalarını TypeScript'e dönüştürmek için:

```bash
npm run clean:js     # TypeScript karşılığı olan JavaScript dosyalarını temizler
npm run ts:convert   # JavaScript dosyalarını TypeScript'e dönüştürür
npm run ts:check     # TypeScript tip kontrolü yapar
```

### Yeni Özellik Ekleme

1. İlgili controller'ı `src/controllers/` dizininde oluşturun
2. Gerekirse yeni model dosyalarını `src/models/` dizininde oluşturun
3. API rotalarını `src/routes/` dizininde oluşturun
4. Doğrulama şemalarını `src/validations/` dizininde oluşturun
5. Socket olaylarını `src/socket/` dizininde oluşturun
6. Testleri `src/__tests__/` dizininde oluşturun

### Kod Standartları

- Tüm dosyalarda JSDoc/TSDoc formatında yorum satırları kullanın
- Modüler yapıyı koruyun, her modül tek bir sorumluluğa sahip olmalı
- Hata yönetimini try-catch blokları ve özel hata sınıfları ile yapın
- Asenkron işlemleri async/await ile yönetin
- Tip güvenliği için TypeScript tip tanımlamalarını kullanın
- Kod kalitesini korumak için ESLint ve Prettier kullanın
- Her özellik için birim ve entegrasyon testleri yazın

### Derleme ve Test

```bash
# Derleme
npm run build

# Lint kontrolü
npm run lint

# Lint düzeltme
npm run lint:fix

# Tip kontrolü
npm run typecheck

# Testleri çalıştırma
npm test

# Test kapsamı raporu
npm run test:coverage
```

## Katkıda Bulunma

1. Bu depoyu fork edin
2. Özellik dalınızı oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some amazing feature'`)
4. Dalınıza push edin (`git push origin feature/amazing-feature`)
5. Bir Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına bakın.
