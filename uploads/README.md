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

- **Backend**: Node.js, Express
- **Veritabanı**: MongoDB (Mongoose)
- **Gerçek Zamanlı İletişim**: Socket.IO
- **Medya Akışı**: Mediasoup (WebRTC SFU)
- **Frontend**: HTML, CSS, JavaScript

## Proje Yapısı

```
fisqos/
├── locales/                # Dil dosyaları
│   ├── en.js               # İngilizce çeviriler
│   ├── tr.js               # Türkçe çeviriler
│   └── index.js            # Dil yönetimi
├── models/                 # Veritabanı modelleri
│   ├── User.js             # Kullanıcı modeli
│   ├── Group.js            # Grup modeli
│   ├── Channel.js          # Kanal modeli
│   ├── Message.js          # Mesaj modeli
│   ├── DMMessage.js        # DM mesaj modeli
│   └── FileAttachment.js   # Dosya eki modeli
├── modules/                # Uygulama modülleri
│   ├── channelManager.js   # Kanal yönetimi
│   ├── dmManager.js        # DM yönetimi
│   ├── fileUpload.js       # Dosya yükleme
│   ├── friendManager.js    # Arkadaşlık sistemi
│   ├── groupManager.js     # Grup yönetimi
│   ├── messageManager.js   # Mesaj yönetimi
│   ├── profileManager.js   # Profil yönetimi
│   ├── richTextFormatter.js # Zengin metin biçimlendirme
│   ├── textChannel.js      # Metin kanalı işlemleri
│   └── userManager.js      # Kullanıcı yönetimi
├── public/                 # Statik dosyalar
│   ├── index.html          # Ana HTML dosyası
│   ├── script.js           # Ana JavaScript dosyası
│   ├── js/                 # JavaScript modülleri
│   └── style/              # CSS dosyaları
├── socket/                 # Socket.IO olayları
│   └── socketEvents.js     # Socket olayları
├── uploads/                # Yüklenen dosyalar
├── app.js                  # Ana uygulama dosyası
├── server.js               # Sunucu başlatma dosyası
├── sfu.js                  # Mediasoup SFU yapılandırması
└── package.json            # Proje bağımlılıkları
```

## Kurulum

1. Gerekli paketleri yükleyin:
   ```
   npm install
   ```

2. MongoDB bağlantı bilgilerini ayarlayın:
   ```
   # .env dosyası oluşturun
   MONGODB_URI=mongodb+srv://kullanici:sifre@cluster.mongodb.net/veritabani
   PORT=80
   ```

3. Sunucuyu başlatın:
   ```
   npm start
   ```

## Geliştirme

### Yeni Özellik Ekleme

1. İlgili modülü `modules/` dizininde oluşturun
2. Gerekirse yeni model dosyalarını `models/` dizininde oluşturun
3. Socket olaylarını `socket/socketEvents.js` dosyasına ekleyin
4. İstemci tarafı kodlarını `public/js/` dizininde oluşturun
5. Dil dosyalarına çevirileri ekleyin

### Kod Standartları

- Tüm dosyalarda JSDoc formatında yorum satırları kullanın
- Modüler yapıyı koruyun, her modül tek bir sorumluluğa sahip olmalı
- Hata yönetimini try-catch blokları ile yapın
- Asenkron işlemleri async/await ile yönetin

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.
