#!/bin/bash

# Renk tanımlamaları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sesli Sohbet Uygulaması Docker Durdurma Scripti${NC}"
echo "----------------------------------------"

# Docker Compose'un yüklü olup olmadığını kontrol et
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose yüklü değil. Lütfen Docker Compose'u yükleyin.${NC}"
    exit 1
fi

# Docker servisini durdur
echo -e "${YELLOW}Docker servisi durduruluyor...${NC}"
docker-compose -f docker-compose.simple.yml down

# Servisin durdurulup durdurulmadığını kontrol et
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker servisi başarıyla durduruldu!${NC}"
else
    echo -e "${RED}Docker servisi durdurulamadı!${NC}"
    exit 1
fi
