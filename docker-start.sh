#!/bin/bash

# Renk tanımlamaları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sesli Sohbet Uygulaması Docker Başlatma Scripti${NC}"
echo "----------------------------------------"

# Docker ve Docker Compose'un yüklü olup olmadığını kontrol et
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker yüklü değil. Lütfen Docker'ı yükleyin.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose yüklü değil. Lütfen Docker Compose'u yükleyin.${NC}"
    exit 1
fi

# Docker servisini başlat
echo -e "${YELLOW}Docker servisi başlatılıyor...${NC}"
docker-compose -f docker-compose.simple.yml up -d

# Servisin başlatılıp başlatılmadığını kontrol et
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker servisi başarıyla başlatıldı!${NC}"
    
    # Container bilgilerini göster
    echo -e "${YELLOW}Container bilgileri:${NC}"
    docker ps --filter "name=sesli-sohbet-api"
    
    # IP adresini al
    CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' sesli-sohbet-api)
    HOST_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}Uygulama başarıyla başlatıldı!${NC}"
    echo -e "${YELLOW}Yerel erişim:${NC} http://localhost:9999"
    echo -e "${YELLOW}Ağ erişimi:${NC} http://$HOST_IP:9999"
    echo -e "${YELLOW}Container IP:${NC} $CONTAINER_IP"
    echo ""
    echo -e "${YELLOW}API Dokümantasyonu:${NC} http://localhost:9999/api-docs"
    echo -e "${YELLOW}Sağlık kontrolü:${NC} http://localhost:9999/health"
else
    echo -e "${RED}Docker servisi başlatılamadı!${NC}"
    exit 1
fi
