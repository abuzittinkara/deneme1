# Fisqos Kurulum ve Yapılandırma Kılavuzu

Bu belge, Fisqos uygulamasının kurulumu ve yapılandırması için detaylı talimatlar içerir.

## İçindekiler

- [Gereksinimler](#gereksinimler)
- [Yerel Geliştirme Ortamı](#yerel-geliştirme-ortamı)
- [Docker ile Kurulum](#docker-ile-kurulum)
- [Üretim Ortamı](#üretim-ortamı)
- [Çevre Değişkenleri](#çevre-değişkenleri)
- [Veritabanı Yapılandırması](#veritabanı-yapılandırması)
- [WebRTC ve Mediasoup Yapılandırması](#webrtc-ve-mediasoup-yapılandırması)
- [Sorun Giderme](#sorun-giderme)

## Gereksinimler

### Yazılım Gereksinimleri

- **Node.js**: 18.x veya üzeri
- **MongoDB**: 4.4 veya üzeri
- **npm**: 8.x veya üzeri
- **Git**: 2.x veya üzeri

### Donanım Gereksinimleri

- **CPU**: En az 2 çekirdek
- **RAM**: En az 2 GB
- **Disk**: En az 1 GB boş alan

### Ağ Gereksinimleri

- **Portlar**: 3000 (HTTP), 10000-10100 (WebRTC)
- **Bant Genişliği**: Ses/video iletişimi için en az 1 Mbps

## Yerel Geliştirme Ortamı

### 1. Depoyu Klonlama

```bash
git clone https://github.com/kullanici/fisqos.git
cd fisqos
```

### 2. Bağımlılıkları Yükleme

```bash
npm install
```

### 3. Çevre Değişkenlerini Ayarlama

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyerek gerekli değişkenleri ayarlayın:

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fisqos
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=*
```

### 4. MongoDB'yi Başlatma

Yerel bir MongoDB sunucusu başlatın:

```bash
# MongoDB'yi yerel olarak başlatma
mongod --dbpath /data/db

# Veya Docker ile başlatma
docker run -d -p 27017:27017 --name mongodb mongo:4.4
```

### 5. Geliştirme Modunda Sunucuyu Başlatma

```bash
npm run dev
```

Sunucu `http://localhost:3000` adresinde çalışmaya başlayacaktır.

### 6. Testleri Çalıştırma

```bash
npm test
```

## Docker ile Kurulum

### 1. Docker ve Docker Compose'u Yükleme

Docker ve Docker Compose'u [resmi Docker dokümantasyonuna](https://docs.docker.com/get-docker/) göre yükleyin.

### 2. Depoyu Klonlama

```bash
git clone https://github.com/kullanici/fisqos.git
cd fisqos
```

### 3. Çevre Değişkenlerini Ayarlama

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyerek gerekli değişkenleri ayarlayın:

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://mongodb:27017/fisqos
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=*
```

### 4. Docker Compose ile Başlatma

```bash
docker-compose up -d
```

Sunucu `http://localhost:3000` adresinde çalışmaya başlayacaktır.

### 5. Logları İzleme

```bash
docker-compose logs -f
```

### 6. Durdurma ve Temizleme

```bash
# Durdurmak için
docker-compose down

# Veritabanı verilerini de silmek için
docker-compose down -v
```

## Üretim Ortamı

### 1. Derleme

```bash
npm run build
```

### 2. Üretim Modunda Başlatma

```bash
NODE_ENV=production npm start
```

### 3. Process Manager ile Başlatma (PM2)

```bash
# PM2'yi yükleme
npm install -g pm2

# Uygulamayı başlatma
pm2 start dist/src/index.js --name fisqos

# Otomatik başlatma ayarı
pm2 startup
pm2 save

# Logları izleme
pm2 logs fisqos
```

## Çevre Değişkenleri

| Değişken | Açıklama | Varsayılan Değer | Gerekli |
|----------|----------|------------------|---------|
| `NODE_ENV` | Çalışma ortamı | `development` | Hayır |
| `PORT` | HTTP sunucusu portu | `3000` | Hayır |
| `MONGODB_URI` | MongoDB bağlantı dizesi | `mongodb://localhost:27017/fisqos` | Evet |
| `JWT_SECRET` | JWT imzalama anahtarı | - | Evet |
| `JWT_EXPIRES_IN` | JWT sona erme süresi | `1h` | Hayır |
| `JWT_REFRESH_SECRET` | JWT yenileme anahtarı | - | Evet |
| `JWT_REFRESH_EXPIRES_IN` | JWT yenileme sona erme süresi | `7d` | Hayır |
| `CORS_ORIGIN` | CORS izin verilen kaynaklar | `*` | Hayır |
| `REDIS_ENABLED` | Redis kullanımını etkinleştirme | `false` | Hayır |
| `REDIS_HOST` | Redis sunucusu adresi | `localhost` | Redis etkinse |
| `REDIS_PORT` | Redis sunucusu portu | `6379` | Redis etkinse |
| `REDIS_PASSWORD` | Redis şifresi | - | Hayır |
| `MEDIASOUP_LISTEN_IP` | Mediasoup dinleme IP'si | `127.0.0.1` | Hayır |
| `MEDIASOUP_ANNOUNCED_IP` | Mediasoup duyurulan IP | `127.0.0.1` | Hayır |
| `MEDIASOUP_MIN_PORT` | Mediasoup minimum port | `10000` | Hayır |
| `MEDIASOUP_MAX_PORT` | Mediasoup maksimum port | `10100` | Hayır |
| `UPLOAD_DIR` | Dosya yükleme dizini | `uploads` | Hayır |
| `MAX_FILE_SIZE` | Maksimum dosya boyutu (byte) | `5242880` (5MB) | Hayır |
| `LOG_LEVEL` | Loglama seviyesi | `info` | Hayır |

## Veritabanı Yapılandırması

### MongoDB Atlas Kullanımı

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) hesabı oluşturun
2. Yeni bir cluster oluşturun
3. Veritabanı erişimi için bir kullanıcı oluşturun
4. IP adresinizi whitelist'e ekleyin
5. Bağlantı dizesini alın ve `.env` dosyasında `MONGODB_URI` olarak ayarlayın

### Yerel MongoDB Kullanımı

1. [MongoDB Community Edition](https://www.mongodb.com/try/download/community) yükleyin
2. MongoDB sunucusunu başlatın
3. Bağlantı dizesini `.env` dosyasında `MONGODB_URI` olarak ayarlayın:
   ```
   MONGODB_URI=mongodb://localhost:27017/fisqos
   ```

### Veritabanı İndeksleri

Uygulama ilk çalıştırıldığında gerekli indeksler otomatik olarak oluşturulur. Manuel olarak oluşturmak için:

```javascript
// MongoDB shell veya Compass'ta çalıştırın
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.groups.createIndex({ inviteCode: 1 }, { unique: true });
db.messages.createIndex({ channel: 1, createdAt: -1 });
```

## WebRTC ve Mediasoup Yapılandırması

### Mediasoup Yapılandırması

`.env` dosyasında aşağıdaki değişkenleri ayarlayın:

```
MEDIASOUP_LISTEN_IP=127.0.0.1
MEDIASOUP_ANNOUNCED_IP=<sunucu_ip_adresi>
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=10100
```

### Firewall Yapılandırması

WebRTC için gerekli portları açın:

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw allow 10000:10100/udp

# iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 10000:10100 -j ACCEPT
```

### TURN Sunucusu Yapılandırması

NAT arkasındaki istemciler için bir TURN sunucusu yapılandırmanız gerekebilir:

1. [coturn](https://github.com/coturn/coturn) yükleyin
2. `/etc/turnserver.conf` dosyasını yapılandırın
3. TURN sunucusunu başlatın
4. İstemci tarafında TURN sunucusu bilgilerini ayarlayın

## Sorun Giderme

### Yaygın Hatalar ve Çözümleri

#### MongoDB Bağlantı Hatası

**Hata**: `MongoNetworkError: failed to connect to server`

**Çözüm**:
- MongoDB sunucusunun çalıştığından emin olun
- Bağlantı dizesini kontrol edin
- IP adresinizin MongoDB Atlas whitelist'inde olduğundan emin olun

#### Port Çakışması

**Hata**: `Error: listen EADDRINUSE: address already in use :::3000`

**Çözüm**:
- Başka bir uygulamanın 3000 portunu kullanıp kullanmadığını kontrol edin
- `.env` dosyasında farklı bir port belirtin

#### WebRTC Bağlantı Sorunları

**Hata**: `ICE connection failed`

**Çözüm**:
- Mediasoup yapılandırmasını kontrol edin
- Firewall ayarlarını kontrol edin
- TURN sunucusu yapılandırın

### Log Dosyaları

Log dosyaları `logs/` dizininde bulunur:

- `logs/all.log`: Tüm loglar
- `logs/error.log`: Sadece hatalar

### Destek Alma

Sorunlarınız için:

1. [GitHub Issues](https://github.com/kullanici/fisqos/issues) sayfasını kontrol edin
2. Yeni bir issue açın
3. Detaylı hata açıklaması ve log dosyalarını ekleyin
