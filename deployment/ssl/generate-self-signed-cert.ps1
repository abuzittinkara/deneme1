# Kendinden imzalı SSL sertifikası oluşturma scripti
Write-Host "Kendinden imzalı SSL sertifikası oluşturuluyor..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# OpenSSL yüklü mü kontrol et
try {
    openssl version | Out-Null
} catch {
    Write-Host "OpenSSL yüklü değil. Lütfen OpenSSL'i yükleyin." -ForegroundColor Red
    Write-Host "Windows için: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Sertifika bilgileri
$DOMAIN = "localhost"
$COUNTRY = "TR"
$STATE = "Istanbul"
$LOCALITY = "Istanbul"
$ORGANIZATION = "Sesli Sohbet"
$ORGANIZATIONAL_UNIT = "Development"
$EMAIL = "admin@example.com"

# Sertifika oluştur
Write-Host "Özel anahtar oluşturuluyor..." -ForegroundColor Yellow
openssl genrsa -out server.key 2048

Write-Host "CSR oluşturuluyor..." -ForegroundColor Yellow
openssl req -new -key server.key -out server.csr -subj "/C=$COUNTRY/ST=$STATE/L=$LOCALITY/O=$ORGANIZATION/OU=$ORGANIZATIONAL_UNIT/CN=$DOMAIN/emailAddress=$EMAIL"

Write-Host "Kendinden imzalı sertifika oluşturuluyor..." -ForegroundColor Yellow
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# Dosyaları taşı
if (!(Test-Path -Path ".")) {
    New-Item -ItemType Directory -Path "."
}

Move-Item -Path server.key -Destination server.key -Force
Move-Item -Path server.crt -Destination server.crt -Force
Remove-Item -Path server.csr -Force

Write-Host "Sertifika oluşturma işlemi tamamlandı!" -ForegroundColor Green
Write-Host "server.key ve server.crt dosyaları oluşturuldu." -ForegroundColor Yellow
