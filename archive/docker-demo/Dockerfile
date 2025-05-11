FROM cgr.dev/chainguard/node:latest-dev AS builder

# Çalışma dizini oluştur
WORKDIR /app

# Gerekli paketleri yükle
USER root
RUN npm init -y && \
    npm install express cors dotenv && \
    npm cache clean --force

# Dosyaları kopyala
COPY .env* ./
COPY server.js ./

# Üretim aşaması
FROM cgr.dev/chainguard/node:latest

# Dosyaları kopyala
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.env* ./
COPY --from=builder /app/server.js ./

# Ortam değişkenleri
ENV NODE_ENV=development
ENV PORT=9999

# Uygulama portunu aç
EXPOSE ${PORT}

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Uygulamayı başlat
CMD ["node", "server.js"]
