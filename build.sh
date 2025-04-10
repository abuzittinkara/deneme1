#!/bin/bash

# Render.com için derleme scripti

# Bağımlılıkları yükle
echo "Bağımlılıklar yükleniyor..."
npm install

# Uploads dizini oluştur (eğer yoksa)
echo "Uploads dizini kontrol ediliyor..."
mkdir -p uploads

# Gerekli izinleri ayarla
echo "İzinler ayarlanıyor..."
chmod +x render-app.js

echo "Derleme tamamlandı!"
