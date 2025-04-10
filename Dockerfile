# Node.js temel imajı - Node.js 18 kullanıyoruz
FROM node:18-alpine

# Python ve build araçlarını ekle
RUN apk add --no-cache python3 py3-pip make g++ python3-dev

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılıkları kopyala
COPY package*.json ./

# Bağımlılıkları yükle ve derleme
RUN npm install

# Uygulama kodunu kopyala
COPY . .

# TypeScript derleme adımını atla
# RUN npm run build

# Sadece üretim bağımlılıklarını yükle
RUN npm install --only=production

# Gereksiz dosyaları temizle
RUN rm -rf .git .github .vscode tests src

# Uygulama portunu aç
EXPOSE 3000

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Uygulamayı başlat
CMD ["node", "render-app.js"]
