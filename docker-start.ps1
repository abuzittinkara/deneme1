# Sesli Sohbet Uygulaması Docker Başlatma Scripti
Write-Host "Sesli Sohbet Uygulaması Docker Başlatma Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker ve Docker Compose'un yüklü olup olmadığını kontrol et
try {
    docker --version | Out-Null
} catch {
    Write-Host "Docker yüklü değil. Lütfen Docker'ı yükleyin." -ForegroundColor Red
    exit 1
}

try {
    docker-compose --version | Out-Null
} catch {
    Write-Host "Docker Compose yüklü değil. Lütfen Docker Compose'u yükleyin." -ForegroundColor Red
    exit 1
}

# Docker servisini başlat
Write-Host "Docker servisi başlatılıyor..." -ForegroundColor Yellow
docker-compose -f docker-compose.simple.yml up -d

# Servisin başlatılıp başlatılmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla başlatıldı!" -ForegroundColor Green
    
    # Container bilgilerini göster
    Write-Host "Container bilgileri:" -ForegroundColor Yellow
    docker ps --filter "name=sesli-sohbet-api"
    
    # IP adresini al
    $CONTAINER_IP = docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' sesli-sohbet-api
    $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Ethernet).IPAddress
    if (-not $HOST_IP) {
        $HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
    }
    
    Write-Host "Uygulama başarıyla başlatıldı!" -ForegroundColor Green
    Write-Host "Yerel erişim: http://localhost:9999" -ForegroundColor Yellow
    Write-Host "Ağ erişimi: http://$HOST_IP`:9999" -ForegroundColor Yellow
    Write-Host "Container IP: $CONTAINER_IP" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "API Dokümantasyonu: http://localhost:9999/api-docs" -ForegroundColor Yellow
    Write-Host "Sağlık kontrolü: http://localhost:9999/health" -ForegroundColor Yellow
} else {
    Write-Host "Docker servisi başlatılamadı!" -ForegroundColor Red
    exit 1
}
