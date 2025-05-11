# Çok aşamalı Dockerfile (dev ve prod için)
ARG NODE_ENV=production

# Geliştirme aşaması
FROM node:20.13.1-bookworm-slim AS builder

# Güvenlik iyileştirmeleri
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser -g 1001 \
    && useradd -r -g appuser -u 1001 -d /app appuser \
    && mkdir -p /app \
    && chown -R appuser:appuser /app

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılıkları kopyala
COPY --chown=appuser:appuser package*.json ./

# Bağımlılıkları yükle
USER appuser
RUN npm ci --production=false

# Uygulama kodunu kopyala
COPY --chown=appuser:appuser . .

# TypeScript derleme
RUN npm run build

# Üretim aşaması
FROM node:20.13.1-bookworm-slim AS production

# Güvenlik iyileştirmeleri
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser -g 1001 \
    && useradd -r -g appuser -u 1001 -d /app appuser \
    && mkdir -p /app \
    && chown -R appuser:appuser /app

# Çalışma dizini oluştur
WORKDIR /app

# Derlenen dosyaları kopyala
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/locales ./locales

# Ortam değişkenleri
ENV NODE_ENV=production
ENV PORT=9092

# Kullanıcıyı değiştir
USER appuser

# Uygulama portunu aç
EXPOSE 9092

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Uygulamayı başlat
CMD ["node", "dist/src/app.js"]

# Geliştirme aşaması
FROM builder AS development

# Ortam değişkenleri
ENV NODE_ENV=development
ENV PORT=9092

# Kullanıcıyı değiştir
USER appuser

# Uygulama portunu aç
EXPOSE 9092

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Uygulamayı başlat
CMD ["node", "dist/src/app.js"]
