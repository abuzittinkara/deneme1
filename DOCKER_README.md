# Docker ile Sesli Sohbet Uygulaması

Bu belge, Sesli Sohbet uygulamasını Docker kullanarak nasıl çalıştıracağınızı açıklar.

## Gereksinimler

- [Docker](https://www.docker.com/products/docker-desktop/) yüklü olmalıdır
- [Docker Compose](https://docs.docker.com/compose/install/) yüklü olmalıdır (Docker Desktop ile birlikte gelir)

## Hızlı Başlangıç

### Windows'ta Çalıştırma

1. PowerShell'i yönetici olarak açın
2. Aşağıdaki komutu çalıştırın:

```powershell
.\docker-start.ps1
```

3. Uygulamayı durdurmak için:

```powershell
.\docker-stop.ps1
```

### Linux/macOS'ta Çalıştırma

1. Terminal açın
2. Aşağıdaki komutu çalıştırın:

```bash
./docker-start.sh
```

3. Uygulamayı durdurmak için:

```bash
./docker-stop.sh
```

## Manuel Çalıştırma

Docker Compose ile manuel olarak çalıştırmak için:

```bash
# Uygulamayı başlatmak için
docker-compose -f docker-compose.simple.yml up -d

# Uygulamayı durdurmak için
docker-compose -f docker-compose.simple.yml down
```

## Erişim Bilgileri

Uygulama başarıyla başlatıldığında aşağıdaki URL'lerden erişebilirsiniz:

- **Yerel Erişim:** http://localhost:9999
- **Ağ Erişimi:** http://[YEREL_IP_ADRESINIZ]:9999
- **API Dokümantasyonu:** http://localhost:9999/api-docs
- **Sağlık Kontrolü:** http://localhost:9999/health

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

### Uygulama Başlatılamıyor

```bash
# Container loglarını kontrol edin
docker logs sesli-sohbet-api

# Docker Compose loglarını kontrol edin
docker-compose -f docker-compose.simple.yml logs
```

### Port Çakışması

Eğer 9999 portu başka bir uygulama tarafından kullanılıyorsa, `docker-compose.simple.yml` dosyasındaki port yapılandırmasını değiştirin:

```yaml
ports:
  - "8080:9999"  # Dış port:İç port
```

### Bağlantı Hatası

Eğer MongoDB Atlas bağlantısında sorun yaşıyorsanız, IP adresinizin MongoDB Atlas'ın beyaz listesinde olduğundan emin olun.

## Güvenlik Notları

- Üretim ortamında kullanmadan önce `.env` dosyasındaki gizli anahtarları değiştirin.
- Dış bağlantı verirken güvenlik duvarı kurallarınızı dikkatli yapılandırın.
- Hassas verileri korumak için HTTPS kullanmayı düşünün.
