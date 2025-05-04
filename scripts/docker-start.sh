#!/bin/bash
# Docker başlatma betiği

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Başlık
echo -e "${BLUE}=== Fisqos API Docker Başlatma Betiği ===${NC}"
echo -e "${BLUE}$(date)${NC}"
echo ""

# Gerekli dizinleri oluştur
echo -e "${YELLOW}Gerekli dizinler oluşturuluyor...${NC}"
mkdir -p logs uploads nginx/conf.d nginx/ssl nginx/www

# .env dosyasını kontrol et
if [ ! -f .env ]; then
  echo -e "${YELLOW}.env dosyası bulunamadı. .env.example dosyası kopyalanıyor...${NC}"
  cp .env.example .env
  echo -e "${GREEN}.env dosyası oluşturuldu. Lütfen gerekli değişiklikleri yapın.${NC}"
fi

# Docker Compose'un yüklü olup olmadığını kontrol et
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Docker Compose bulunamadı. Lütfen Docker Compose'u yükleyin.${NC}"
  exit 1
fi

# Docker'ın çalışıp çalışmadığını kontrol et
if ! docker info &> /dev/null; then
  echo -e "${RED}Docker çalışmıyor veya yetki hatası var. Lütfen Docker'ı başlatın veya yetki sorununu çözün.${NC}"
  exit 1
fi

# Ortam değişkenlerini yükle
echo -e "${YELLOW}Ortam değişkenleri yükleniyor...${NC}"
source .env

# Docker Compose ile servisleri başlat
echo -e "${YELLOW}Docker Compose ile servisler başlatılıyor...${NC}"
docker-compose up -d

# Servislerin durumunu kontrol et
echo -e "${YELLOW}Servislerin durumu kontrol ediliyor...${NC}"
docker-compose ps

# Logları göster
echo -e "${YELLOW}API servisi logları gösteriliyor (çıkmak için Ctrl+C)...${NC}"
docker-compose logs -f api
