# Sesli Sohbet Demo Docker Başlatma Scripti
Write-Host "Sesli Sohbet Demo Docker Başlatma Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker servisini başlat
Write-Host "Docker servisi başlatılıyor..." -ForegroundColor Yellow
docker-compose up -d

# Servisin başlatılıp başlatılmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla başlatıldı!" -ForegroundColor Green
    
    # Container bilgilerini göster
    Write-Host "Container bilgileri:" -ForegroundColor Yellow
    docker ps --filter "name=sesli-sohbet-demo"
    
    # IP adresini al
    $CONTAINER_IP = docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' sesli-sohbet-demo
    $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Ethernet).IPAddress
    if (-not $HOST_IP) {
        $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
    }
    
    Write-Host "Uygulama başarıyla başlatıldı!" -ForegroundColor Green
    Write-Host "Yerel erişim: http://localhost:9999" -ForegroundColor Yellow
    Write-Host "Ağ erişimi: http://$HOST_IP`:9999" -ForegroundColor Yellow
    Write-Host "Container IP: $CONTAINER_IP" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "API Bilgisi: http://localhost:9999/api/info" -ForegroundColor Yellow
    Write-Host "Sağlık kontrolü: http://localhost:9999/api/health" -ForegroundColor Yellow
} else {
    Write-Host "Docker servisi başlatılamadı!" -ForegroundColor Red
    exit 1
}
