# Sesli Sohbet Uygulaması Docker Durdurma Scripti (Tam Versiyon)
Write-Host "Sesli Sohbet Uygulaması Docker Durdurma Scripti (Tam Versiyon)" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker servisini durdur
Write-Host "Docker servisi durduruluyor..." -ForegroundColor Yellow
docker-compose -f docker-compose.full.yml down

# Servisin durdurulup durdurulmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla durduruldu!" -ForegroundColor Green
} else {
    Write-Host "Docker servisi durdurulamadı!" -ForegroundColor Red
    exit 1
}
