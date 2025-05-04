# Sesli Sohbet Uygulaması Docker Durum Scripti
Write-Host "Sesli Sohbet Uygulaması Docker Durum Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Container durumlarını görüntüle
Write-Host "Container durumları:" -ForegroundColor Yellow
docker ps --filter "name=sesli-sohbet"

# Container sağlık durumlarını görüntüle
Write-Host ""
Write-Host "Container sağlık durumları:" -ForegroundColor Yellow
$containers = docker ps --filter "name=sesli-sohbet" --format "{{.Names}}"
foreach ($container in $containers) {
    $health = docker inspect --format "{{.State.Health.Status}}" $container
    if ($health) {
        Write-Host "$container: $health" -ForegroundColor $(if ($health -eq "healthy") { "Green" } elseif ($health -eq "starting") { "Yellow" } else { "Red" })
    } else {
        Write-Host "$container: Sağlık kontrolü yok" -ForegroundColor Gray
    }
}

# Kaynak kullanımını görüntüle
Write-Host ""
Write-Host "Kaynak kullanımı:" -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" $(docker ps --filter "name=sesli-sohbet" --format "{{.Names}}")
