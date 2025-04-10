# Node.js temel imajı
FROM node:16-alpine

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılıkları kopyala
COPY package*.json ./

# Bağımlılıkları yükle ve derleme
RUN npm ci

# Uygulama kodunu kopyala
COPY . .

# TypeScript kodunu derle
RUN npm run build

# Sadece üretim bağımlılıklarını yükle
RUN npm ci --only=production

# Gereksiz dosyaları temizle
RUN rm -rf .git .github .vscode tests src

# Uygulama portunu aç
EXPOSE 3000

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Uygulamayı başlat
CMD ["node", "dist/app.js"]
