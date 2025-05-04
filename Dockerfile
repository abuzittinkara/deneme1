# Derleme aşaması
FROM node:20.13.1-bookworm-slim AS builder

# Derleme için gerekli paketleri yükle
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılıkları kopyala
COPY package*.json ./
COPY tsconfig*.json ./

# Bağımlılıkları yükle
RUN npm ci

# Uygulama kodunu kopyala
COPY . .

# TypeScript derleme
RUN npm run build

# Üretim aşaması
FROM node:20.13.1-bookworm-slim AS production

# Güvenlik için root olmayan kullanıcı oluştur
RUN groupadd -r nodejs && useradd -r -g nodejs -m -s /bin/bash nodejs

# Çalışma dizini oluştur
WORKDIR /app

# Gerekli paketleri yükle
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Sadece üretim bağımlılıklarını kopyala
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Derlenen dosyaları kopyala
COPY --from=builder /app/dist ./dist

# Uploads dizini oluştur ve izinleri ayarla
RUN mkdir -p /app/uploads /app/logs \
    && chown -R nodejs:nodejs /app

# Ortam değişkenleri
ENV NODE_ENV=production
ENV PORT=9092
ENV HOST=0.0.0.0
ENV TZ=UTC

# Uygulama portunu aç
EXPOSE ${PORT}

# nodejs kullanıcısına geç
USER nodejs

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/config/status || exit 1

# Uygulamayı başlat
CMD ["node", "--max-old-space-size=512", "dist/src/app.js"]
