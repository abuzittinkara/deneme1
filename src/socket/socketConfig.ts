/**
 * src/socket/socketConfig.ts
 * Socket.IO yapılandırması
 */
import { Server as SocketIOServer, ServerOptions } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { redisClient } from '../config/redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { instrument } from '@socket.io/admin-ui';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { verifyToken } from '../utils/jwt';
import { User, UserStatus } from '../models/User';
import { promisify } from 'util';

// Redis adapter için pub/sub istemcileri
let pubClient: any;
let subClient: any;

// Hız sınırlayıcılar
const connectionLimiter = new RateLimiterMemory({
  points: 5, // 5 bağlantı
  duration: 10, // 10 saniye içinde
  blockDuration: 30 // 30 saniye engelle
});

const messageLimiter = new RateLimiterMemory({
  points: 20, // 20 mesaj
  duration: 10, // 10 saniye içinde
  blockDuration: 60 // 60 saniye engelle
});

/**
 * Socket.IO sunucusunu yapılandır
 * @param server - HTTP veya HTTPS sunucusu
 * @returns Socket.IO sunucusu
 */
export function configureSocketServer(server: HttpServer | HttpsServer): SocketIOServer {
  // Socket.IO seçenekleri
  const socketOptions: Partial<ServerOptions> = {
    path: '/socket.io',
    serveClient: env.isDevelopment, // Geliştirme modunda istemci dosyalarını sun
    connectTimeout: 15000, // 15 saniye bağlantı zaman aşımı
    pingTimeout: 10000, // 10 saniye ping zaman aşımı
    pingInterval: 25000, // 25 saniye ping aralığı
    upgradeTimeout: 10000, // 10 saniye yükseltme zaman aşımı
    maxHttpBufferSize: 1e6, // 1MB maksimum HTTP arabellek boyutu
    transports: ['websocket', 'polling'], // WebSocket ve polling destekle
    allowEIO3: false, // Engine.IO 3 protokolünü destekleme
    cors: {
      origin: env.CORS_ORIGIN === '*' 
        ? true 
        : env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    cookie: {
      name: 'fisqos.io',
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 86400000 // 24 saat
    }
  };

  // Socket.IO sunucusunu oluştur
  const io = new SocketIOServer(server, socketOptions);

  // Redis adapter'ı yapılandır (opsiyonel)
  if (env.isProduction && env.REDIS_ENABLED === 'true') {
    try {
      // Redis pub/sub istemcilerini oluştur
      pubClient = redisClient.duplicate();
      subClient = redisClient.duplicate();

      // Redis adapter'ı oluştur
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter yapılandırıldı');
    } catch (error) {
      logger.error('Socket.IO Redis adapter yapılandırma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    }
  }

  // Admin UI yapılandır (opsiyonel, sadece geliştirme modunda)
  if (env.isDevelopment && env.SOCKET_ADMIN_UI_ENABLED === 'true') {
    try {
      instrument(io, {
        auth: {
          type: 'basic',
          username: env.SOCKET_ADMIN_UI_USERNAME || 'admin',
          password: env.SOCKET_ADMIN_UI_PASSWORD || 'admin'
        },
        mode: env.isDevelopment ? 'development' : 'production'
      });
      logger.info('Socket.IO Admin UI yapılandırıldı');
    } catch (error) {
      logger.error('Socket.IO Admin UI yapılandırma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    }
  }

  // Middleware: Bağlantı hız sınırlama
  io.use(async (socket, next) => {
    try {
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      const ipStr = Array.isArray(clientIp) ? clientIp[0] : clientIp;

      await connectionLimiter.consume(ipStr);
      next();
    } catch (error) {
      logger.warn('Socket.IO bağlantı hız sınırı aşıldı', {
        ip: socket.handshake.address,
        headers: socket.handshake.headers
      });
      next(new Error('Çok fazla bağlantı denemesi. Lütfen daha sonra tekrar deneyin.'));
    }
  });

  // Middleware: Kimlik doğrulama
  io.use(async (socket, next) => {
    try {
      // Geliştirme modunda kimlik doğrulamayı atla (opsiyonel)
      if (env.isDevelopment && env.SKIP_SOCKET_AUTH === 'true') {
        logger.info('Geliştirme modunda Socket.IO kimlik doğrulama atlandı', { socketId: socket.id });
        
        // Geliştirme modu için test kullanıcısı
        socket.data.userId = 'dev-user-id';
        socket.data.username = 'dev-user';
        socket.data.role = 'user';
        socket.data.authenticated = true;
        
        return next();
      }

      // Token'ı al
      const token = 
        socket.handshake.auth.token || 
        socket.handshake.headers.authorization?.split(' ')[1] ||
        socket.handshake.query.token;

      if (!token) {
        logger.warn('Socket.IO bağlantısı için token bulunamadı', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Kimlik doğrulama gerekli'));
      }

      // Token'ı doğrula
      const decoded = await verifyToken(token);

      // Kullanıcıyı veritabanından kontrol et
      const user = await User.findById(decoded.id).select('username role status lastSeen');

      if (!user) {
        logger.warn('Socket.IO bağlantısı için kullanıcı bulunamadı', {
          socketId: socket.id,
          userId: decoded.id,
          ip: socket.handshake.address
        });
        return next(new Error('Kullanıcı bulunamadı'));
      }

      // Kullanıcı durumunu kontrol et
      if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
        logger.warn('Engellenmiş veya askıya alınmış kullanıcı bağlantı denemesi', {
          socketId: socket.id,
          userId: user._id.toString(),
          username: user.username,
          status: user.status,
          ip: socket.handshake.address
        });
        return next(new Error('Hesabınız engellenmiş veya askıya alınmış'));
      }

      // Socket.data'ya kullanıcı bilgilerini ekle
      socket.data.userId = user._id.toString();
      socket.data.username = user.username;
      socket.data.role = user.role;
      socket.data.authenticated = true;

      // Son görülme zamanını güncelle
      user.lastSeen = new Date();
      await user.save();

      logger.debug('Socket.IO kimlik doğrulama başarılı', {
        socketId: socket.id,
        userId: user._id.toString(),
        username: user.username
      });

      next();
    } catch (error) {
      logger.warn('Socket.IO kimlik doğrulama hatası', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        ip: socket.handshake.address
      });
      next(new Error('Kimlik doğrulama hatası'));
    }
  });

  // Middleware: Mesaj hız sınırlama
  io.use((socket, next) => {
    // Mesaj olayları için hız sınırlama
    socket.on('message', async (data, callback) => {
      try {
        const userId = socket.data.userId;
        await messageLimiter.consume(userId);
        
        // Orijinal olay işleyicisini çağır
        socket.emit('message', data, callback);
      } catch (error) {
        logger.warn('Socket.IO mesaj hız sınırı aşıldı', {
          socketId: socket.id,
          userId: socket.data.userId
        });
        
        if (typeof callback === 'function') {
          callback({
            success: false,
            error: {
              message: 'Çok fazla mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.',
              code: 'RATE_LIMIT_EXCEEDED'
            }
          });
        }
      }
    });

    next();
  });

  // Bağlantı olayı
  io.on('connection', (socket) => {
    logger.info('Socket.IO bağlantısı kuruldu', {
      socketId: socket.id,
      userId: socket.data.userId,
      username: socket.data.username,
      transport: socket.conn.transport.name,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

    // Bağlantı kesilme olayı
    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO bağlantısı kesildi', {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
        reason
      });
    });

    // Hata olayı
    socket.on('error', (error) => {
      logger.error('Socket.IO hatası', {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
        error: error instanceof Error ? error.message : error
      });
    });

    // Ping olayı
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ time: Date.now() });
      }
    });
  });

  // Engine olayları
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO Engine bağlantı hatası', {
      error: err.message,
      code: err.code,
      type: err.type,
      req: err.req ? {
        url: err.req.url,
        method: err.req.method,
        headers: err.req.headers
      } : undefined
    });
  });

  logger.info('Socket.IO sunucusu yapılandırıldı');

  return io;
}

/**
 * Socket.IO sunucusunu kapat
 * @param io - Socket.IO sunucusu
 */
export async function closeSocketServer(io: SocketIOServer): Promise<void> {
  try {
    // Tüm istemcilere kapatma bildirimi gönder
    io.emit('server:shutdown', {
      message: 'Sunucu kapatılıyor, lütfen daha sonra tekrar bağlanın',
      timestamp: new Date().toISOString()
    });

    // Tüm bağlantıları kapat
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Redis adapter'ı kapat
    if (pubClient && subClient) {
      const quitAsync = promisify(pubClient.quit).bind(pubClient);
      await quitAsync();
      
      const quitSubAsync = promisify(subClient.quit).bind(subClient);
      await quitSubAsync();
    }

    // Socket.IO sunucusunu kapat
    const closeAsync = promisify(io.close).bind(io);
    await closeAsync();

    logger.info('Socket.IO sunucusu kapatıldı');
  } catch (error) {
    logger.error('Socket.IO sunucusu kapatılırken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}

export default {
  configureSocketServer,
  closeSocketServer
};
