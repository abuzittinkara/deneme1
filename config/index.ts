// config/index.ts
import dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

interface MongoDBConfig {
  uri: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
  };
}

interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

interface SocketIOConfig {
  cors: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
}

interface CorsConfig {
  origin: string | string[];
  methods: string[];
  allowedHeaders: string[];
}

interface Config {
  server: ServerConfig;
  mongodb: MongoDBConfig;
  jwt: JWTConfig;
  socketio: SocketIOConfig;
  cors: CorsConfig;
}

const config: Config = {
  // Sunucu yapılandırması
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
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

export default config;
