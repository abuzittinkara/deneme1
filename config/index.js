// config/index.js
const dotenv = require('dotenv');

// .env dosyasını yükle
dotenv.config();

module.exports = {
  // Sunucu yapılandırması
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // MongoDB yapılandırması
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fisqos',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT yapılandırması
  jwt: {
    secret: process.env.JWT_SECRET || 'fisqos-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fisqos-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Socket.IO yapılandırması
  socketio: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  },
  
  // CORS yapılandırması
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};
