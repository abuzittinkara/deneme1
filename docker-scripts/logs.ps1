# Sesli Sohbet Uygulaması Docker Log Görüntüleme Scripti
param (
    [string]$service = "api",
    [int]$lines = 100
)

Write-Host "Sesli Sohbet Uygulaması Docker Log Görüntüleme Scripti" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Servis adına göre container adını belirle
$containerName = ""
switch ($service) {
    "api" { $containerName = "sesli-sohbet-api" }
    "mongodb" { $containerName = "sesli-sohbet-mongodb" }
    "redis" { $containerName = "sesli-sohbet-redis" }
    "demo" { $containerName = "sesli-sohbet-demo" }
    default { $containerName = "sesli-sohbet-api" }
}

# Logları görüntüle
Write-Host "$containerName logları görüntüleniyor..." -ForegroundColor Yellow
docker logs --tail $lines -f $containerName
