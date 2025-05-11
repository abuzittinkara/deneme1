# Fisqos Docker Kılavuzu

Bu belge, Fisqos uygulamasını Docker kullanarak nasıl çalıştıracağınızı ve yöneteceğinizi açıklar.

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
11. [Güvenlik İyileştirmeleri](#güvenlik-iyileştirmeleri)

## Gereksinimler

- [Docker](https://www.docker.com/products/docker-desktop/) yüklü olmalıdır
- [Docker Compose](https://docs.docker.com/compose/install/) yüklü olmalıdır (Docker Desktop ile birlikte gelir)
- En az 2GB RAM ve 10GB disk alanı

## Kurulum

### Ortam Değişkenleri

Uygulamayı başlatmadan önce, `.env` dosyasını oluşturun veya `.env.example` dosyasını kopyalayıp düzenleyin:

```bash
cp .env.example .env
```

Özellikle aşağıdaki değişkenleri ayarladığınızdan emin olun:

- `JWT_SECRET`: JWT token'ları için gizli anahtar
- `JWT_REFRESH_SECRET`: JWT yenileme token'ları için gizli anahtar
- `MONGODB_URI`: MongoDB bağlantı URI'si
- `MONGODB_USER`: MongoDB kullanıcı adı
- `MONGODB_PASSWORD`: MongoDB şifresi

### Birleştirilmiş Sürüm

Tüm servisleri (API, MongoDB, Redis, Mediasoup ve Nginx) içeren birleştirilmiş sürümü başlatmak için:

```bash
docker-compose -f docker-compose.unified.yml up -d
```

### Minimal Sürüm

Sadece API servisini başlatmak için:

```bash
docker-compose -f docker-compose.simple.yml up -d
```

## Başlatma ve Durdurma

### Başlatma

```bash
# Birleştirilmiş sürüm
docker-compose -f docker-compose.unified.yml up -d

# Minimal sürüm
docker-compose -f docker-compose.simple.yml up -d
```

### Durdurma

```bash
# Birleştirilmiş sürüm
docker-compose -f docker-compose.unified.yml down

# Minimal sürüm
docker-compose -f docker-compose.simple.yml down
```

### Yeniden Başlatma

```bash
# Birleştirilmiş sürüm
docker-compose -f docker-compose.unified.yml restart

# Minimal sürüm
docker-compose -f docker-compose.simple.yml restart
```

## Yapılandırma

### Ortam Değişkenleri

Docker Compose dosyalarında ortam değişkenlerini yapılandırabilirsiniz:

- `docker-compose.unified.yml`: Tüm servisler için
- `docker-compose.simple.yml`: Minimal sürüm için

### MongoDB Yapılandırması

Birleştirilmiş sürümde MongoDB servisini yapılandırmak için:

```yaml
mongodb:
  image: mongo:6.0
  environment:
    - MONGO_INITDB_ROOT_USERNAME=${MONGODB_USER:-admin}
    - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_PASSWORD:-password}
```

### Redis Yapılandırması

Birleştirilmiş sürümde Redis servisini yapılandırmak için:

```yaml
redis:
  image: redis:7.0-alpine
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-}
```

### Mediasoup Yapılandırması

Mediasoup servisini yapılandırmak için:

```yaml
mediasoup:
  environment:
    - MEDIASOUP_MIN_PORT=${MEDIASOUP_MIN_PORT:-10000}
    - MEDIASOUP_MAX_PORT=${MEDIASOUP_MAX_PORT:-10999}
```

## Logları Görüntüleme

```bash
# API loglarını görüntülemek için
docker-compose -f docker-compose.unified.yml logs api

# MongoDB loglarını görüntülemek için
docker-compose -f docker-compose.unified.yml logs mongodb

# Redis loglarını görüntülemek için
docker-compose -f docker-compose.unified.yml logs redis

# Mediasoup loglarını görüntülemek için
docker-compose -f docker-compose.unified.yml logs mediasoup

# Nginx loglarını görüntülemek için
docker-compose -f docker-compose.unified.yml logs nginx

# Tüm logları görüntülemek için
docker-compose -f docker-compose.unified.yml logs
```

## Durum Kontrolü

```bash
# Tüm servislerin durumunu kontrol etmek için
docker-compose -f docker-compose.unified.yml ps

# API servisinin sağlık durumunu kontrol etmek için
curl http://localhost:9092/api/health
```

## Temizleme

```bash
# Container'ları durdurmak ve kaldırmak için
docker-compose -f docker-compose.unified.yml down

# Container'ları ve volume'ları kaldırmak için
docker-compose -f docker-compose.unified.yml down -v

# Tüm container'ları, imajları ve volume'ları temizlemek için
docker system prune -a --volumes
```

## Dış Bağlantı Verme

Uygulamaya internet üzerinden erişim sağlamak için:

1. Router'ınızda port yönlendirme yapılandırın:
   - Dış Port: 9092
   - İç Port: 9092
   - İç IP Adresi: Bilgisayarınızın yerel IP adresi (örn. 192.168.1.100)

2. Güvenlik duvarı ayarlarınızı kontrol edin ve 9092 portunu açın.

3. Dış IP adresinizi öğrenmek için [whatismyip.com](https://www.whatismyip.com/) gibi bir siteyi ziyaret edin.

4. Uygulamaya dış IP adresiniz ve port numarası ile erişebilirsiniz:
   - http://[DIŞ_IP_ADRESİNİZ]:9092

## Sorun Giderme

### Container Başlatılamıyor

```bash
# Container loglarını kontrol edin
docker logs fisqos-api

# Docker Compose loglarını kontrol edin
docker-compose -f docker-compose.unified.yml logs
```

### Port Çakışması

Eğer 9092 portu başka bir uygulama tarafından kullanılıyorsa, Docker Compose dosyasındaki port yapılandırmasını değiştirin:

```yaml
ports:
  - "8080:9092"  # Dış port:İç port
```

### MongoDB Bağlantı Hatası

Eğer MongoDB bağlantısında sorun yaşıyorsanız:

```bash
# MongoDB container'ının çalıştığından emin olun
docker ps --filter "name=fisqos-mongodb"

# MongoDB loglarını kontrol edin
docker logs fisqos-mongodb
```

### Redis Bağlantı Hatası

Eğer Redis bağlantısında sorun yaşıyorsanız:

```bash
# Redis container'ının çalıştığından emin olun
docker ps --filter "name=fisqos-redis"

# Redis loglarını kontrol edin
docker logs fisqos-redis
```

### Mediasoup Bağlantı Hatası

Eğer Mediasoup bağlantısında sorun yaşıyorsanız:

```bash
# Mediasoup container'ının çalıştığından emin olun
docker ps --filter "name=fisqos-mediasoup"

# Mediasoup loglarını kontrol edin
docker logs fisqos-mediasoup

# UDP portlarının açık olduğundan emin olun
netstat -an | grep -E "10000|10999"
```

## Güvenlik Notları

- Üretim ortamında kullanmadan önce `.env` dosyasındaki gizli anahtarları değiştirin.
- MongoDB ve Redis için güçlü parolalar kullanın.
- Dış bağlantı verirken güvenlik duvarı kurallarınızı dikkatli yapılandırın.
- Hassas verileri korumak için HTTPS kullanmayı düşünün.
- Container'ları root olmayan kullanıcı ile çalıştırın.
- Docker imajlarını düzenli olarak güncelleyin.

## Güvenlik İyileştirmeleri

### Chainguard Distroless İmajı

Güvenlik açıklarını gidermek için Chainguard Distroless imajını kullanıyoruz. Bu imaj, sıfır güvenlik açığı içeren minimal bir Node.js çalışma ortamı sağlar.

#### Chainguard Distroless İmajı Nedir?

Chainguard Distroless imajları, sadece uygulamanızı çalıştırmak için gereken minimum bileşenleri içerir. Bu imajlarda:

- Kabuk (shell) yoktur
- Paket yöneticisi yoktur
- Gereksiz sistem araçları yoktur
- Sadece uygulamanızı çalıştırmak için gereken çalışma zamanı bileşenleri vardır

Bu minimalist yaklaşım, güvenlik açıklarının sayısını önemli ölçüde azaltır ve imaj boyutunu küçültür.

#### Avantajları

1. **Sıfır Güvenlik Açığı**: Chainguard Distroless imajları, güvenlik açıklarını en aza indirmek için tasarlanmıştır.
2. **Küçük İmaj Boyutu**: Gereksiz bileşenler olmadığı için imaj boyutu küçüktür.
3. **Güvenli Varsayılan Ayarlar**: İmajlar, güvenli varsayılan ayarlarla gelir.
4. **Düzenli Güncellemeler**: Chainguard, imajları düzenli olarak günceller ve güvenlik yamaları uygular.
