# Docker ile Sesli Sohbet Uygulaması

## Genel Bakış

Bu proje, Sesli Sohbet uygulamasının Docker ile çalıştırılmasını sağlar. Uygulama, Node.js, MongoDB, Redis, Socket.IO ve Mediasoup teknolojilerini kullanır.

## Docker Yapılandırmaları

Proje, farklı kullanım senaryoları için çeşitli Docker yapılandırmaları sunar:

### 1. Demo Sürümü

Basit bir API servisi içerir. Geliştirme ve test amaçlıdır.

- **Dosyalar:** `docker-demo/Dockerfile`, `docker-demo/docker-compose.yml`
- **Başlatma:** `cd docker-demo && .\start.ps1`
- **Durdurma:** `cd docker-demo && .\stop.ps1`

### 2. Geliştirme Sürümü

API servisi, MongoDB ve Redis servislerini içerir. Geliştirme ortamı için uygundur.

- **Dosyalar:** `Dockerfile.full`, `docker-compose.full.yml`
- **Başlatma:** `cd docker-scripts && .\start-full.ps1`
- **Durdurma:** `cd docker-scripts && .\stop-full.ps1`

### 3. Üretim Sürümü

API servisi, MongoDB, Redis ve Nginx servislerini içerir. Üretim ortamı için optimize edilmiştir.

- **Dosyalar:** `Dockerfile.prod`, `docker-compose.prod.yml`
- **Başlatma:** `docker-compose -f docker-compose.prod.yml up -d`
- **Durdurma:** `docker-compose -f docker-compose.prod.yml down`

## Dizin Yapısı

```
.
├── docker-demo/                # Demo sürümü dosyaları
│   ├── Dockerfile              # Demo sürümü Dockerfile
│   ├── docker-compose.yml      # Demo sürümü Docker Compose
│   ├── server.js               # Demo sürümü API servisi
│   ├── start.ps1               # Demo sürümü başlatma scripti
│   └── stop.ps1                # Demo sürümü durdurma scripti
├── docker-scripts/             # Docker yönetim scriptleri
│   ├── start-full.ps1          # Tam sürüm başlatma scripti
│   ├── stop-full.ps1           # Tam sürüm durdurma scripti
│   ├── logs.ps1                # Log görüntüleme scripti
│   ├── status.ps1              # Durum kontrol scripti
│   └── cleanup.ps1             # Temizleme scripti
├── deployment/                 # Deployment dosyaları
│   ├── nginx.conf              # Nginx yapılandırması
│   ├── ssl/                    # SSL sertifikaları
│   │   └── generate-self-signed-cert.ps1  # Sertifika oluşturma scripti
│   └── www/                    # Web sayfaları
│       └── index.html          # Örnek web sayfası
├── Dockerfile.full             # Tam sürüm Dockerfile
├── Dockerfile.prod             # Üretim sürümü Dockerfile
├── docker-compose.simple.yml   # Basit Docker Compose
├── docker-compose.full.yml     # Tam Docker Compose
├── docker-compose.prod.yml     # Üretim Docker Compose
├── DOCKER_GUIDE.md             # Detaylı Docker kılavuzu
└── DOCKER_SUMMARY.md           # Bu dosya
```

## Portlar

- **API Servisi:** 9999
- **MongoDB:** 27017
- **Redis:** 6379
- **Nginx:** 80, 443

## Dış Bağlantı Verme

Uygulamaya internet üzerinden erişim sağlamak için:

1. Router'ınızda port yönlendirme yapılandırın:
   - Dış Port: 9999 (veya 80/443)
   - İç Port: 9999 (veya 80/443)
   - İç IP Adresi: Bilgisayarınızın yerel IP adresi

2. Güvenlik duvarı ayarlarınızı kontrol edin ve ilgili portları açın.

3. Dış IP adresinizi öğrenmek için [whatismyip.com](https://www.whatismyip.com/) gibi bir siteyi ziyaret edin.

4. Uygulamaya dış IP adresiniz ve port numarası ile erişebilirsiniz.

## Daha Fazla Bilgi

Daha detaylı bilgi için `DOCKER_GUIDE.md` dosyasını inceleyebilirsiniz.
