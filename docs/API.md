# Fisqos API Dokümantasyonu

Bu belge, Fisqos uygulamasının API endpoint'lerini ve kullanımlarını açıklar.

## İçindekiler

- [Genel Bilgiler](#genel-bilgiler)
- [Kimlik Doğrulama](#kimlik-doğrulama)
- [Kullanıcı API](#kullanıcı-api)
- [Grup API](#grup-api)
- [Kanal API](#kanal-api)
- [Mesaj API](#mesaj-api)
- [Arkadaşlık API](#arkadaşlık-api)
- [Dosya Yükleme API](#dosya-yükleme-api)
- [WebSocket API](#websocket-api)
- [Hata Kodları](#hata-kodları)

## Genel Bilgiler

### Temel URL

```
https://api.fisqos.com/api
```

Yerel geliştirme için:

```
http://localhost:3000/api
```

### İstek Formatı

Tüm HTTP istekleri JSON formatında veri kabul eder ve döndürür.

```
Content-Type: application/json
```

### Yanıt Formatı

Tüm API yanıtları aşağıdaki formatta döndürülür:

```json
{
  "success": true,
  "data": { ... }
}
```

Hata durumunda:

```json
{
  "success": false,
  "error": {
    "message": "Hata mesajı",
    "type": "ValidationError",
    "stack": "..." // Sadece geliştirme modunda
  }
}
```

### Sayfalama

Sayfalama gerektiren endpoint'ler aşağıdaki parametreleri destekler:

- `page`: Sayfa numarası (varsayılan: 1)
- `limit`: Sayfa başına öğe sayısı (varsayılan: 20, maksimum: 100)

Yanıt, sayfalama meta verileri içerir:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "pages": 5
    }
  }
}
```

## Kimlik Doğrulama

### Kayıt Olma

```
POST /auth/register
```

**İstek Gövdesi:**

```json
{
  "username": "kullanici_adi",
  "email": "kullanici@example.com",
  "password": "guclu_sifre",
  "name": "Ad",
  "surname": "Soyad",
  "birthdate": "1990-01-01",
  "phone": "+905551234567"
}
```

**Yanıt:**

```json
{
  "success": true,
  "message": "Kayıt başarılı",
  "data": {
    "userId": "60a1b2c3d4e5f6g7h8i9j0k1",
    "username": "kullanici_adi"
  }
}
```

### Giriş Yapma

```
POST /auth/login
```

**İstek Gövdesi:**

```json
{
  "username": "kullanici_adi",
  "password": "guclu_sifre"
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "userId": "60a1b2c3d4e5f6g7h8i9j0k1",
    "username": "kullanici_adi",
    "name": "Ad",
    "surname": "Soyad",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Token Yenileme

```
POST /auth/refresh-token
```

**İstek Gövdesi:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Çıkış Yapma

```
POST /auth/logout
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "message": "Çıkış başarılı"
}
```

## Kullanıcı API

### Kullanıcı Profili Alma

```
GET /users/me
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
    "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
    "username": "kullanici_adi",
    "email": "kullanici@example.com",
    "name": "Ad",
    "surname": "Soyad",
    "profilePicture": "https://example.com/uploads/profile.jpg",
    "status": "online",
    "lastSeen": "2023-06-15T10:30:45Z",
    "createdAt": "2023-01-01T12:00:00Z"
  }
}
```

### Kullanıcı Profili Güncelleme

```
PUT /users/me
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "name": "Yeni Ad",
  "surname": "Yeni Soyad",
  "profilePicture": "https://example.com/uploads/new-profile.jpg",
  "status": "away"
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
    "username": "kullanici_adi",
    "email": "kullanici@example.com",
    "name": "Yeni Ad",
    "surname": "Yeni Soyad",
    "profilePicture": "https://example.com/uploads/new-profile.jpg",
    "status": "away",
    "lastSeen": "2023-06-15T10:30:45Z",
    "updatedAt": "2023-06-15T11:45:30Z"
  }
}
```

### Kullanıcı Arama

```
GET /users/search?query=ara
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "kullanici_adi",
      "name": "Ad",
      "surname": "Soyad",
      "profilePicture": "https://example.com/uploads/profile.jpg",
      "status": "online"
    },
    {
      "_id": "60a1b2c3d4e5f6g7h8i9j0k2",
      "username": "baska_kullanici",
      "name": "Başka",
      "surname": "Kullanıcı",
      "profilePicture": "https://example.com/uploads/profile2.jpg",
      "status": "offline"
    }
  ],
  "meta": {
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

## Grup API

### Grupları Listeleme

```
GET /groups
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "70a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Arkadaşlar",
      "description": "Arkadaşlarla sohbet grubu",
      "avatar": "https://example.com/uploads/group1.jpg",
      "inviteCode": "a1b2c3d4",
      "owner": "60a1b2c3d4e5f6g7h8i9j0k1",
      "createdAt": "2023-01-15T14:30:00Z"
    },
    {
      "_id": "70a1b2c3d4e5f6g7h8i9j0k2",
      "name": "İş",
      "description": "İş arkadaşları grubu",
      "avatar": "https://example.com/uploads/group2.jpg",
      "inviteCode": "e5f6g7h8",
      "owner": "60a1b2c3d4e5f6g7h8i9j0k2",
      "createdAt": "2023-02-20T09:15:00Z"
    }
  ]
}
```

### Grup Oluşturma

```
POST /groups
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "name": "Yeni Grup",
  "description": "Yeni grup açıklaması"
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "70a1b2c3d4e5f6g7h8i9j0k3",
    "name": "Yeni Grup",
    "description": "Yeni grup açıklaması",
    "inviteCode": "i9j0k1l2",
    "owner": "60a1b2c3d4e5f6g7h8i9j0k1",
    "createdAt": "2023-06-15T12:00:00Z"
  }
}
```

### Gruba Katılma

```
POST /groups/join
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "inviteCode": "a1b2c3d4"
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "70a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Arkadaşlar",
    "description": "Arkadaşlarla sohbet grubu",
    "owner": "60a1b2c3d4e5f6g7h8i9j0k1",
    "createdAt": "2023-01-15T14:30:00Z"
  }
}
```

### Grup Detayları

```
GET /groups/{groupId}
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
    "_id": "70a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Arkadaşlar",
    "description": "Arkadaşlarla sohbet grubu",
    "avatar": "https://example.com/uploads/group1.jpg",
    "owner": {
      "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "kullanici_adi",
      "name": "Ad",
      "surname": "Soyad",
      "profilePicture": "https://example.com/uploads/profile.jpg"
    },
    "members": [
      {
        "user": {
          "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
          "username": "kullanici_adi",
          "name": "Ad",
          "surname": "Soyad",
          "profilePicture": "https://example.com/uploads/profile.jpg",
          "status": "online"
        },
        "role": "owner",
        "joinedAt": "2023-01-15T14:30:00Z"
      },
      {
        "user": {
          "_id": "60a1b2c3d4e5f6g7h8i9j0k2",
          "username": "baska_kullanici",
          "name": "Başka",
          "surname": "Kullanıcı",
          "profilePicture": "https://example.com/uploads/profile2.jpg",
          "status": "offline"
        },
        "role": "member",
        "joinedAt": "2023-01-16T10:45:00Z"
      }
    ],
    "channels": [
      {
        "_id": "80a1b2c3d4e5f6g7h8i9j0k1",
        "name": "Genel",
        "description": "Genel sohbet kanalı",
        "type": "text",
        "createdAt": "2023-01-15T14:30:00Z"
      },
      {
        "_id": "80a1b2c3d4e5f6g7h8i9j0k2",
        "name": "Sesli Sohbet",
        "description": "Sesli sohbet kanalı",
        "type": "voice",
        "createdAt": "2023-01-15T14:30:00Z"
      }
    ],
    "createdAt": "2023-01-15T14:30:00Z"
  }
}
```

## Kanal API

### Kanalları Listeleme

```
GET /groups/{groupId}/channels
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Yanıt:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "80a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Genel",
      "description": "Genel sohbet kanalı",
      "type": "text",
      "isPrivate": false,
      "createdAt": "2023-01-15T14:30:00Z"
    },
    {
      "_id": "80a1b2c3d4e5f6g7h8i9j0k2",
      "name": "Sesli Sohbet",
      "description": "Sesli sohbet kanalı",
      "type": "voice",
      "isPrivate": false,
      "createdAt": "2023-01-15T14:30:00Z"
    }
  ]
}
```

### Kanal Oluşturma

```
POST /groups/{groupId}/channels
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "name": "Yeni Kanal",
  "description": "Yeni kanal açıklaması",
  "type": "text",
  "isPrivate": false
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "80a1b2c3d4e5f6g7h8i9j0k3",
    "name": "Yeni Kanal",
    "description": "Yeni kanal açıklaması",
    "type": "text",
    "isPrivate": false,
    "group": "70a1b2c3d4e5f6g7h8i9j0k1",
    "createdBy": "60a1b2c3d4e5f6g7h8i9j0k1",
    "createdAt": "2023-06-15T13:30:00Z"
  }
}
```

## Mesaj API

### Mesajları Listeleme

```
GET /channels/{channelId}/messages
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sorgu Parametreleri:**

- `limit`: Sayfa başına mesaj sayısı (varsayılan: 50)
- `before`: Bu tarihten önceki mesajları getir (ISO 8601 formatında)

**Yanıt:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "90a1b2c3d4e5f6g7h8i9j0k1",
      "content": "Merhaba dünya!",
      "sender": {
        "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
        "username": "kullanici_adi",
        "name": "Ad",
        "surname": "Soyad",
        "profilePicture": "https://example.com/uploads/profile.jpg"
      },
      "channel": "80a1b2c3d4e5f6g7h8i9j0k1",
      "attachments": [],
      "isEdited": false,
      "createdAt": "2023-06-15T14:00:00Z"
    },
    {
      "_id": "90a1b2c3d4e5f6g7h8i9j0k2",
      "content": "Nasılsınız?",
      "sender": {
        "_id": "60a1b2c3d4e5f6g7h8i9j0k2",
        "username": "baska_kullanici",
        "name": "Başka",
        "surname": "Kullanıcı",
        "profilePicture": "https://example.com/uploads/profile2.jpg"
      },
      "channel": "80a1b2c3d4e5f6g7h8i9j0k1",
      "attachments": [],
      "isEdited": false,
      "createdAt": "2023-06-15T14:05:00Z"
    }
  ],
  "meta": {
    "limit": 50,
    "hasMore": false,
    "oldest": "2023-06-15T14:00:00Z",
    "newest": "2023-06-15T14:05:00Z"
  }
}
```

### Mesaj Gönderme

```
POST /channels/{channelId}/messages
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "content": "Yeni bir mesaj",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/uploads/image.jpg",
      "name": "resim.jpg"
    }
  ]
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "90a1b2c3d4e5f6g7h8i9j0k3",
    "content": "Yeni bir mesaj",
    "sender": {
      "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "kullanici_adi",
      "name": "Ad",
      "surname": "Soyad",
      "profilePicture": "https://example.com/uploads/profile.jpg"
    },
    "channel": "80a1b2c3d4e5f6g7h8i9j0k1",
    "attachments": [
      {
        "type": "image",
        "url": "https://example.com/uploads/image.jpg",
        "name": "resim.jpg"
      }
    ],
    "isEdited": false,
    "createdAt": "2023-06-15T14:10:00Z"
  }
}
```

### Mesaj Düzenleme

```
PUT /messages/{messageId}
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi:**

```json
{
  "content": "Düzenlenmiş mesaj"
}
```

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "_id": "90a1b2c3d4e5f6g7h8i9j0k3",
    "content": "Düzenlenmiş mesaj",
    "sender": {
      "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "kullanici_adi",
      "name": "Ad",
      "surname": "Soyad",
      "profilePicture": "https://example.com/uploads/profile.jpg"
    },
    "channel": "80a1b2c3d4e5f6g7h8i9j0k1",
    "attachments": [
      {
        "type": "image",
        "url": "https://example.com/uploads/image.jpg",
        "name": "resim.jpg"
      }
    ],
    "isEdited": true,
    "editedAt": "2023-06-15T14:15:00Z",
    "createdAt": "2023-06-15T14:10:00Z"
  }
}
```

### Mesaj Silme

```
DELETE /messages/{messageId}
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
    "message": "Mesaj başarıyla silindi",
    "id": "90a1b2c3d4e5f6g7h8i9j0k3"
  }
}
```

## Dosya Yükleme API

### Dosya Yükleme

```
POST /upload
```

**Yetkilendirme Başlığı:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**İstek Gövdesi (multipart/form-data):**

- `file`: Yüklenecek dosya
- `type`: Dosya tipi (image, video, audio, file)

**Yanıt:**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/uploads/file.jpg",
    "name": "file.jpg",
    "type": "image",
    "size": 1024000,
    "mimeType": "image/jpeg",
    "uploadedAt": "2023-06-15T14:20:00Z"
  }
}
```

## WebSocket API

WebSocket API, Socket.IO kütüphanesi kullanılarak gerçekleştirilmiştir. İstemci, sunucuya bağlanmak için aşağıdaki URL'yi kullanır:

```
ws://localhost:3000
```

veya

```
wss://api.fisqos.com
```

### Kimlik Doğrulama

Socket.IO bağlantısı kurulduktan sonra, istemci `authenticate` olayını göndererek kimlik doğrulama yapmalıdır:

```javascript
socket.emit('authenticate', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' });
```

Sunucu, kimlik doğrulama başarılı olursa `authenticated` olayını gönderir:

```javascript
socket.on('authenticated', (data) => {
  console.log('Kimlik doğrulama başarılı:', data);
});
```

### Olaylar

#### Kullanıcı Durumu Değişiklikleri

```javascript
// Kullanıcı çevrimiçi olduğunda
socket.on('user:online', (data) => {
  console.log('Kullanıcı çevrimiçi:', data.userId);
});

// Kullanıcı çevrimdışı olduğunda
socket.on('user:offline', (data) => {
  console.log('Kullanıcı çevrimdışı:', data.userId);
});

// Kullanıcı durumu değiştiğinde
socket.on('user:status', (data) => {
  console.log('Kullanıcı durumu değişti:', data.userId, data.status);
});
```

#### Mesaj Olayları

```javascript
// Yeni mesaj alındığında
socket.on('message:new', (data) => {
  console.log('Yeni mesaj:', data);
});

// Mesaj düzenlendiğinde
socket.on('message:update', (data) => {
  console.log('Mesaj düzenlendi:', data);
});

// Mesaj silindiğinde
socket.on('message:delete', (data) => {
  console.log('Mesaj silindi:', data.messageId);
});
```

#### Kanal Olayları

```javascript
// Yeni kanal oluşturulduğunda
socket.on('channel:new', (data) => {
  console.log('Yeni kanal:', data);
});

// Kanal güncellendiğinde
socket.on('channel:update', (data) => {
  console.log('Kanal güncellendi:', data);
});

// Kanal silindiğinde
socket.on('channel:delete', (data) => {
  console.log('Kanal silindi:', data.channelId);
});
```

#### Grup Olayları

```javascript
// Yeni grup oluşturulduğunda
socket.on('group:new', (data) => {
  console.log('Yeni grup:', data);
});

// Grup güncellendiğinde
socket.on('group:update', (data) => {
  console.log('Grup güncellendi:', data);
});

// Grup silindiğinde
socket.on('group:delete', (data) => {
  console.log('Grup silindi:', data.groupId);
});
```

## Hata Kodları

| Kod | Tip | Açıklama |
|-----|-----|----------|
| 400 | ValidationError | İstek parametreleri geçersiz |
| 401 | AuthenticationError | Kimlik doğrulama hatası |
| 403 | ForbiddenError | Yetki hatası |
| 404 | NotFoundError | Kaynak bulunamadı |
| 409 | ConflictError | Kaynak çakışması |
| 500 | ServerError | Sunucu hatası |
| 503 | ServiceUnavailableError | Servis kullanılamıyor |

### Hata Örnekleri

#### Kimlik Doğrulama Hatası

```json
{
  "success": false,
  "error": {
    "message": "Geçersiz token",
    "type": "AuthenticationError"
  }
}
```

#### Doğrulama Hatası

```json
{
  "success": false,
  "error": {
    "message": "Kullanıcı adı en az 3 karakter olmalıdır",
    "type": "ValidationError"
  }
}
```

#### Kaynak Bulunamadı Hatası

```json
{
  "success": false,
  "error": {
    "message": "Kullanıcı bulunamadı",
    "type": "NotFoundError"
  }
}
```
```
