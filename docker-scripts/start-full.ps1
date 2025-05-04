# Sesli Sohbet Uygulaması Docker Başlatma Scripti (Tam Versiyon)
Write-Host "Sesli Sohbet Uygulaması Docker Başlatma Scripti (Tam Versiyon)" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker servisini başlat
Write-Host "Docker servisi başlatılıyor..." -ForegroundColor Yellow
docker-compose -f docker-compose.full.yml up -d

# Servisin başlatılıp başlatılmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla başlatıldı!" -ForegroundColor Green
    
    # Container bilgilerini göster
    Write-Host "Container bilgileri:" -ForegroundColor Yellow
    docker ps --filter "name=sesli-sohbet"
    
    # IP adresini al
    $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Ethernet).IPAddress
    if (-not $HOST_IP) {
        $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
    }
    
    Write-Host "Uygulama başarıyla başlatıldı!" -ForegroundColor Green
    Write-Host "Yerel erişim: http://localhost:9999" -ForegroundColor Yellow
    Write-Host "Ağ erişimi: http://$HOST_IP`:9999" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "API Dokümantasyonu: http://localhost:9999/api-docs" -ForegroundColor Yellow
    Write-Host "Sağlık kontrolü: http://localhost:9999/api/health" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "MongoDB: mongodb://localhost:27017" -ForegroundColor Yellow
    Write-Host "Redis: redis://localhost:6379" -ForegroundColor Yellow
} else {
    Write-Host "Docker servisi başlatılamadı!" -ForegroundColor Red
    exit 1
}
