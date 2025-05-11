# Fisqos Geliştirici Kılavuzu

Bu kılavuz, Fisqos uygulamasının geliştirilmesi için gerekli bilgileri içerir. Fisqos, Discord benzeri bir sesli ve yazılı iletişim platformudur.

## İçindekiler

1. [Başlarken](#başlarken)
2. [Proje Yapısı](#proje-yapısı)
3. [Teknoloji Yığını](#teknoloji-yığını)
4. [Geliştirme Ortamı](#geliştirme-ortamı)
5. [API Referansı](#api-referansı)
6. [WebRTC Entegrasyonu](#webrtc-entegrasyonu)
7. [Socket.IO Olayları](#socketio-olayları)
8. [Veritabanı Şeması](#veritabanı-şeması)
9. [Test](#test)
10. [Dağıtım](#dağıtım)

## Başlarken

### Gereksinimleri Kurma

Fisqos'u geliştirmek için aşağıdaki yazılımlara ihtiyacınız vardır:

- Node.js (v18.x veya üzeri)
- npm (v9.x veya üzeri)
- MongoDB (v6.x veya üzeri)
- Git

### Projeyi Klonlama

```bash
git clone https://github.com/kullanici/fisqos.git
cd fisqos
```

### Bağımlılıkları Kurma

```bash
npm install
```

### Geliştirme Sunucusunu Başlatma

```bash
npm run dev
```

Bu komut, uygulamayı geliştirme modunda başlatır ve `http://localhost:3001` adresinde kullanılabilir hale getirir.

## Proje Yapısı

```
fisqos/
├── docs/                 # Dokümantasyon
├── public/               # İstemci tarafı dosyalar
│   ├── css/              # CSS dosyaları
│   ├── js/               # JavaScript/TypeScript dosyaları
│   ├── images/           # Resimler
│   └── index.html        # Ana HTML dosyası
├── src/                  # Sunucu tarafı kaynak kodları
│   ├── config/           # Yapılandırma dosyaları
│   ├── controllers/      # Denetleyiciler
│   ├── middleware/       # Ara yazılımlar
│   ├── models/           # Veritabanı modelleri
│   ├── routes/           # API rotaları
│   ├── services/         # İş mantığı servisleri
│   ├── socket/           # Socket.IO işleyicileri
│   ├── types/            # TypeScript tipleri
│   ├── utils/            # Yardımcı fonksiyonlar
│   ├── app.ts            # Express uygulaması
│   └── server.ts         # HTTP sunucusu
├── tests/                # Test dosyaları
│   ├── unit/             # Birim testleri
│   └── integration/      # Entegrasyon testleri
├── .env.example          # Örnek çevre değişkenleri
├── .gitignore            # Git tarafından yok sayılacak dosyalar
├── package.json          # Proje meta verileri ve bağımlılıkları
├── tsconfig.json         # TypeScript yapılandırması
└── README.md             # Proje açıklaması
```

## Teknoloji Yığını

### Sunucu Tarafı

- **Node.js**: JavaScript çalışma zamanı
- **Express**: Web çerçevesi
- **TypeScript**: Statik tip sistemi
- **Socket.IO**: Gerçek zamanlı iletişim
- **Mediasoup**: WebRTC SFU (Seçici İletim Birimi)
- **MongoDB**: NoSQL veritabanı
- **Mongoose**: MongoDB ODM (Nesne Belge Eşleyicisi)
- **JWT**: JSON Web Token kimlik doğrulama

### İstemci Tarafı

- **HTML5**: Markup dili
- **CSS3**: Stil sayfaları
- **TypeScript**: Statik tip sistemi
- **Socket.IO Client**: Gerçek zamanlı iletişim
- **MediasoupClient**: WebRTC istemci kütüphanesi

## Geliştirme Ortamı

### Çevre Değişkenleri

Uygulamayı yapılandırmak için `.env` dosyası oluşturun:

```
# Sunucu
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/fisqos

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Mediasoup
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
```

### Kod Stili

Kod stilini korumak için ESLint ve Prettier kullanılmaktadır:

```bash
# Kod stilini kontrol et
npm run lint

# Kod stilini düzelt
npm run lint:fix

# Kodu formatla
npm run format
```

## API Referansı

API dokümantasyonu için [API Dokümantasyonu](api.md) dosyasına bakın.

## WebRTC Entegrasyonu

Fisqos, görüntülü görüşme ve ekran paylaşımı için WebRTC teknolojisini kullanır. WebRTC entegrasyonu, Mediasoup kütüphanesi kullanılarak gerçekleştirilmiştir.

### WebRTC Servisi

`WebRTCService` sınıfı, WebRTC bağlantılarını yönetir:

```typescript
class WebRTCService {
  // Mediasoup işçilerini oluşturur
  async createWorkers(): Promise<void>;
  
  // Yeni bir router oluşturur
  async createRouter(): Promise<string>;
  
  // WebRTC transport oluşturur
  async createWebRtcTransport(routerId: string, options?: any): Promise<any>;
  
  // Transport'u bağlar
  async connectTransport(transportId: string, dtlsParameters: any): Promise<boolean>;
  
  // Producer oluşturur
  async createProducer(transportId: string, rtpParameters: any, kind: string): Promise<string>;
  
  // Consumer oluşturur
  async createConsumer(transportId: string, producerId: string, rtpCapabilities: any): Promise<any>;
  
  // Oda oluşturur
  async createRoom(roomId: string): Promise<string>;
  
  // Odaya kullanıcı ekler
  async addPeerToRoom(roomId: string, userId: string): Promise<boolean>;
  
  // Odadan kullanıcı çıkarır
  async removePeerFromRoom(roomId: string, userId: string): Promise<boolean>;
}
```

### WebRTC İstemci Bileşeni

İstemci tarafında, WebRTC bağlantılarını yönetmek için `call.ts` bileşeni kullanılır:

```typescript
// Görüntülü görüşme bileşenini başlatır
function initCallComponent(): void;

// Görüşme başlatır
async function startCall(channelId: string): Promise<void>;

// Görüşmeye katılır
async function joinCall(callId: string, channelId: string): Promise<void>;

// Görüşmeden ayrılır
function leaveCall(): void;

// Sesi açar/kapatır
function toggleAudio(): void;

// Videoyu açar/kapatır
function toggleVideo(): void;

// Ekran paylaşımını başlatır/durdurur
async function toggleScreenShare(): Promise<void>;
```

## Socket.IO Olayları

Fisqos, gerçek zamanlı iletişim için Socket.IO kullanır. Aşağıda, uygulamada kullanılan Socket.IO olayları listelenmiştir:

### Mesaj Olayları

- `message:send`: Yeni bir mesaj gönderir
- `message:new`: Yeni bir mesaj alındığında tetiklenir
- `message:edit`: Bir mesajı düzenler
- `message:update`: Bir mesaj düzenlendiğinde tetiklenir
- `message:delete`: Bir mesajı siler
- `message:reaction`: Bir mesaja tepki ekler
- `message:reaction:remove`: Bir mesajdan tepki kaldırır
- `user:typing`: Kullanıcı yazıyor durumunu bildirir

### Çevrimiçi Durum Olayları

- `presence:online`: Kullanıcı çevrimiçi olduğunda tetiklenir
- `presence:offline`: Kullanıcı çevrimdışı olduğunda tetiklenir
- `presence:status`: Kullanıcı durumu değiştiğinde tetiklenir
- `presence:list`: Çevrimiçi kullanıcıların listesini alır

### Görüşme Olayları

- `call:start`: Yeni bir görüşme başlatır
- `call:join`: Bir görüşmeye katılır
- `call:leave`: Bir görüşmeden ayrılır
- `call:end`: Bir görüşmeyi sonlandırır
- `call:media-state`: Medya durumunu günceller
- `call:screen-share`: Ekran paylaşımı durumunu günceller

### WebRTC Olayları

- `webrtc:get-router-capabilities`: Router RTP yeteneklerini alır
- `webrtc:router-capabilities`: Router RTP yeteneklerini döndürür
- `webrtc:create-transport`: Yeni bir transport oluşturur
- `webrtc:transport-created`: Transport oluşturulduğunda tetiklenir
- `webrtc:connect-transport`: Transport'u bağlar
- `webrtc:transport-connected`: Transport bağlandığında tetiklenir
- `webrtc:produce`: Yeni bir producer oluşturur
- `webrtc:producer-created`: Producer oluşturulduğunda tetiklenir
- `webrtc:new-producer`: Yeni bir producer eklendiğinde tetiklenir
- `webrtc:consume`: Yeni bir consumer oluşturur
- `webrtc:consumer-created`: Consumer oluşturulduğunda tetiklenir
- `webrtc:resume-consumer`: Consumer'ı başlatır
- `webrtc:consumer-resumed`: Consumer başlatıldığında tetiklenir
- `webrtc:peer-left`: Bir kullanıcı odadan ayrıldığında tetiklenir

## Veritabanı Şeması

Fisqos, MongoDB veritabanını kullanır. Aşağıda, uygulamada kullanılan veritabanı şemaları listelenmiştir:

### Kullanıcı Şeması

```typescript
interface User {
  _id: ObjectId;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  onlineStatus: {
    isOnline: boolean;
    lastActiveAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Grup Şeması

```typescript
interface Group {
  _id: ObjectId;
  name: string;
  description?: string;
  type: 'public' | 'private';
  icon?: string;
  members: Array<{
    userId: ObjectId;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
  }>;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### Kanal Şeması

```typescript
interface Channel {
  _id: ObjectId;
  name: string;
  description?: string;
  type: 'text' | 'voice';
  groupId: ObjectId;
  isPrivate: boolean;
  allowedUsers?: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### Mesaj Şeması

```typescript
interface Message {
  _id: ObjectId;
  content: string;
  channel: ObjectId;
  author: ObjectId;
  mentions: ObjectId[];
  attachments: Array<{
    url: string;
    type: string;
    name: string;
    size: number;
  }>;
  reactions: Array<{
    emoji: string;
    users: ObjectId[];
  }>;
  quotedMessage?: ObjectId;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Test

Fisqos, birim testleri ve entegrasyon testleri için Mocha, Chai ve Sinon kullanır.

### Birim Testleri Çalıştırma

```bash
npm run test:unit
```

### Entegrasyon Testleri Çalıştırma

```bash
npm run test:integration
```

### Tüm Testleri Çalıştırma

```bash
npm test
```

## Dağıtım

Fisqos, Docker kullanılarak dağıtılabilir.

### Docker İmajı Oluşturma

```bash
docker build -t fisqos .
```

### Docker Konteyneri Çalıştırma

```bash
docker run -p 3001:3001 -e MONGODB_URI=mongodb://mongo:27017/fisqos -e JWT_SECRET=your_jwt_secret fisqos
```

### Docker Compose ile Çalıştırma

```bash
docker-compose up -d
```

Bu, MongoDB ve Fisqos uygulamasını içeren bir Docker Compose yapılandırması kullanarak uygulamayı başlatır.
