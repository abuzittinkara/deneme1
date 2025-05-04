# Sesli Sohbet Demo Docker Durdurma Scripti
Write-Host "Sesli Sohbet Demo Docker Durdurma Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Docker servisini durdur
Write-Host "Docker servisi durduruluyor..." -ForegroundColor Yellow
docker-compose down

# Servisin durdurulup durdurulmadığını kontrol et
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker servisi başarıyla durduruldu!" -ForegroundColor Green
} else {
    Write-Host "Docker servisi durdurulamadı!" -ForegroundColor Red
    exit 1
}
