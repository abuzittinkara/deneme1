/**
 * tests/globalSetup.js
 * Jest global kurulum
 */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  // .env.test dosyasını oluştur (yoksa)
  const envTestPath = path.resolve(process.cwd(), '.env.test');
  
  if (!fs.existsSync(envTestPath)) {
    console.log('Creating .env.test file for testing...');
    
    const envContent = `
# Test ortamı için .env dosyası
NODE_ENV=test
PORT=10001
HOST=localhost

# Test veritabanı ayarları (bellek içi MongoDB kullanılacak)
MONGODB_URI=mongodb://localhost:27017/test
MONGODB_DB_NAME=test

# JWT ayarları
JWT_SECRET=test_jwt_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=test_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Redis ayarları (test için kullanılmayacak)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# Dosya yükleme ayarları
UPLOAD_DIR=uploads/test
MAX_FILE_SIZE=5242880

# Loglama ayarları
LOG_LEVEL=error

# API ayarları
API_BASE_URL=http://localhost:10001/api
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
`;
    
    fs.writeFileSync(envTestPath, envContent.trim());
    console.log('.env.test file created successfully.');
  }
  
  // .env.test dosyasını yükle
  dotenv.config({ path: envTestPath });
  
  // Test uploads dizinini oluştur
  const testUploadsDir = path.resolve(process.cwd(), 'uploads/test');
  
  if (!fs.existsSync(testUploadsDir)) {
    fs.mkdirSync(testUploadsDir, { recursive: true });
    console.log('Test uploads directory created.');
  }
  
  console.log('Global setup completed.');
};
