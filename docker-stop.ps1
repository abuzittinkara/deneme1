# Sesli Sohbet Uygulaması Docker Durdurma Scripti
Write-Host "Sesli Sohbet Uygulaması Docker Durdurma Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker Compose'un yüklü olup olmadığını kontrol et
try {
    docker-compose --version | Out-Null
} catch {
    Write-Host "Docker Compose yüklü değil. Lütfen Docker Compose'u yükleyin." -ForegroundColor Red
    exit 1
}

# Docker servisini durdur
Write-Host "Docker servisi durduruluyor..." -ForegroundColor Yellow
docker-compose -f docker-compose.simple.yml down

# Servisin durdurulup durdurulmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla durduruldu!" -ForegroundColor Green
} else {
    Write-Host "Docker servisi durdurulamadı!" -ForegroundColor Red
    exit 1
}
