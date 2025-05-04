# Docker ile Sesli Sohbet Uygulaması Kullanım Kılavuzu

Bu belge, Sesli Sohbet uygulamasını Docker kullanarak nasıl çalıştıracağınızı ve yöneteceğinizi açıklar.

## İçindekiler

1. [Gereksinimler](#gereksinimler)
2. [Kurulum](#kurulum)
3. [Başlatma ve Durdurma](#başlatma-ve-durdurma)
4. [Yapılandırma](#yapılandırma)
5. [Logları Görüntüleme](#logları-görüntüleme)
6. [Durum Kontrolü](#durum-kontrolü)
7. [Temizleme](#temizleme)
8. [Dış Bağlantı Verme](#dış-bağlantı-verme)
9. [Sorun Giderme](#sorun-giderme)
10. [Güvenlik Notları](#güvenlik-notları)

## Gereksinimler

- [Docker](https://www.docker.com/products/docker-desktop/) yüklü olmalıdır
- [Docker Compose](https://docs.docker.com/compose/install/) yüklü olmalıdır (Docker Desktop ile birlikte gelir)
- En az 2GB RAM ve 10GB disk alanı

## Kurulum

### Demo Sürümü

Demo sürümü, sadece API servisini içerir ve MongoDB Atlas'a bağlanır:

```powershell
cd docker-demo
.\start.ps1
```

### Tam Sürüm

Tam sürüm, API servisi, MongoDB ve Redis servislerini içerir:

```powershell
cd docker-scripts
.\start-full.ps1
```

## Başlatma ve Durdurma

### Demo Sürümü

```powershell
# Başlatmak için
cd docker-demo
.\start.ps1

# Durdurmak için
cd docker-demo
.\stop.ps1
```

### Tam Sürüm

```powershell
# Başlatmak için
cd docker-scripts
.\start-full.ps1

# Durdurmak için
cd docker-scripts
.\stop-full.ps1
```

## Yapılandırma

### Ortam Değişkenleri

Docker Compose dosyalarında ortam değişkenlerini yapılandırabilirsiniz:

- `docker-compose.simple.yml`: Demo sürümü için
- `docker-compose.full.yml`: Tam sürüm için

### MongoDB Yapılandırması

Tam sürümde MongoDB servisini yapılandırmak için:

```yaml
mongodb:
  image: mongo:6.0
  environment:
    - MONGO_INITDB_ROOT_USERNAME=admin
    - MONGO_INITDB_ROOT_PASSWORD=password
```

### Redis Yapılandırması

Tam sürümde Redis servisini yapılandırmak için:

```yaml
redis:
  image: redis:7.0-alpine
  command: ["redis-server", "--requirepass", "password"]
```

## Logları Görüntüleme

```powershell
# API loglarını görüntülemek için
cd docker-scripts
.\logs.ps1 -service api -lines 100

# MongoDB loglarını görüntülemek için
.\logs.ps1 -service mongodb -lines 100

# Redis loglarını görüntülemek için
.\logs.ps1 -service redis -lines 100
```

## Durum Kontrolü

```powershell
cd docker-scripts
.\status.ps1
```

## Temizleme

```powershell
cd docker-scripts

# Kullanılmayan container'ları temizlemek için
.\cleanup.ps1

# Tüm container'ları, imajları ve volume'ları temizlemek için
.\cleanup.ps1 -all

# Sadece volume'ları temizlemek için
.\cleanup.ps1 -volumes

# Sadece imajları temizlemek için
.\cleanup.ps1 -images

# Zorla temizlemek için (dikkatli kullanın!)
.\cleanup.ps1 -all -force
```

## Dış Bağlantı Verme

Uygulamaya internet üzerinden erişim sağlamak için:

1. Router'ınızda port yönlendirme yapılandırın:
   - Dış Port: 9999
   - İç Port: 9999
   - İç IP Adresi: Bilgisayarınızın yerel IP adresi (örn. 192.168.1.100)

2. Güvenlik duvarı ayarlarınızı kontrol edin ve 9999 portunu açın.

3. Dış IP adresinizi öğrenmek için [whatismyip.com](https://www.whatismyip.com/) gibi bir siteyi ziyaret edin.

4. Uygulamaya dış IP adresiniz ve port numarası ile erişebilirsiniz:
   - http://[DIŞ_IP_ADRESİNİZ]:9999

## Sorun Giderme

### Container Başlatılamıyor

```powershell
# Container loglarını kontrol edin
docker logs sesli-sohbet-api

# Docker Compose loglarını kontrol edin
docker-compose -f docker-compose.full.yml logs
```

### Port Çakışması

Eğer 9999 portu başka bir uygulama tarafından kullanılıyorsa, Docker Compose dosyasındaki port yapılandırmasını değiştirin:

```yaml
ports:
  - "8080:9999"  # Dış port:İç port
```

### MongoDB Bağlantı Hatası

Eğer MongoDB bağlantısında sorun yaşıyorsanız:

```powershell
# MongoDB container'ının çalıştığından emin olun
docker ps --filter "name=sesli-sohbet-mongodb"

# MongoDB loglarını kontrol edin
docker logs sesli-sohbet-mongodb
```

### Redis Bağlantı Hatası

Eğer Redis bağlantısında sorun yaşıyorsanız:

```powershell
# Redis container'ının çalıştığından emin olun
docker ps --filter "name=sesli-sohbet-redis"

# Redis loglarını kontrol edin
docker logs sesli-sohbet-redis
```

## Güvenlik Notları

- Üretim ortamında kullanmadan önce `.env` dosyasındaki gizli anahtarları değiştirin.
- MongoDB ve Redis için güçlü parolalar kullanın.
- Dış bağlantı verirken güvenlik duvarı kurallarınızı dikkatli yapılandırın.
- Hassas verileri korumak için HTTPS kullanmayı düşünün.
- Container'ları root olmayan kullanıcı ile çalıştırın.
- Docker imajlarını düzenli olarak güncelleyin.
