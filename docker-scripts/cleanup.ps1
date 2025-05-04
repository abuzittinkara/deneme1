# Sesli Sohbet Uygulaması Docker Temizleme Scripti
param (
    [switch]$all = $false,
    [switch]$volumes = $false,
    [switch]$images = $false,
    [switch]$force = $false
)

Write-Host "Sesli Sohbet Uygulaması Docker Temizleme Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Tüm container'ları durdur
if ($all -or $force) {
    Write-Host "Tüm container'lar durduruluyor..." -ForegroundColor Yellow
    docker-compose -f docker-compose.full.yml down
    docker-compose -f docker-compose.simple.yml down
}

# Kullanılmayan container'ları temizle
Write-Host "Kullanılmayan container'lar temizleniyor..." -ForegroundColor Yellow
docker container prune -f

# Kullanılmayan imajları temizle
if ($all -or $images) {
    Write-Host "Kullanılmayan imajlar temizleniyor..." -ForegroundColor Yellow
    docker image prune -f
    
    if ($force) {
        Write-Host "Sesli sohbet imajları siliniyor..." -ForegroundColor Yellow
        docker rmi $(docker images --filter "reference=sesli-sohbet*" -q) -f
    }
}

# Kullanılmayan volumeleri temizle
if ($all -or $volumes) {
    Write-Host "Kullanılmayan volume'lar temizleniyor..." -ForegroundColor Yellow
    docker volume prune -f
    
    if ($force) {
        Write-Host "Sesli sohbet volume'ları siliniyor..." -ForegroundColor Yellow
        docker volume rm $(docker volume ls --filter "name=sesli-sohbet*" -q) -f
    }
}

# Kullanılmayan ağları temizle
Write-Host "Kullanılmayan ağlar temizleniyor..." -ForegroundColor Yellow
docker network prune -f

Write-Host "Temizleme işlemi tamamlandı!" -ForegroundColor Green
