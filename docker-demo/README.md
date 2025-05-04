# Docker Demo - Sesli Sohbet API

Bu demo, Sesli Sohbet API'sinin Docker ile nasıl çalıştırılacağını gösterir.

## Başlatma

Windows'ta PowerShell kullanarak:

```powershell
.\start.ps1
```

Manuel olarak:

```bash
docker-compose up -d
```

## Durdurma

Windows'ta PowerShell kullanarak:

```powershell
.\stop.ps1
```

Manuel olarak:

```bash
docker-compose down
```

## API Endpointleri

- Ana Sayfa: http://localhost:9999/
- Sağlık Kontrolü: http://localhost:9999/api/health
- API Bilgisi: http://localhost:9999/api/info

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
