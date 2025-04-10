/**************************************
 * socket/index.js
 * Socket.IO sunucusunu yapılandırır ve olayları kaydeder
 **************************************/
const socketIO = require('socket.io');
const WebSocket = require('ws');
const { createAdapter } = require('@socket.io/redis-adapter');
const { logger } = require('../utils/logger');
const { redisClient } = require('../config/redis');
const onlineManager = require('../modules/user/onlineManager');
const sessionManager = require('../modules/session/sessionManager');

// Socket handlers
const registerUserHandlers = require('./handlers/user/userHandlers');
const registerSecurityHandlers = require('./handlers/security/securityHandlers');
const registerGroupHandlers = require('./handlers/group/groupHandlers');
const registerChannelHandlers = require('./handlers/channel/channelHandlers');
const registerMessageHandlers = require('./handlers/message/messageHandlers');
const registerDMHandlers = require('./handlers/dm/dmHandlers');
const registerFriendHandlers = require('./handlers/friend/friendHandlers');
const registerMediaHandlers = require('./handlers/media/mediaHandlers');
const registerRoleHandlers = require('./handlers/role/roleHandlers');
const registerNotificationHandlers = require('./handlers/notification/notificationHandlers');
const registerWebRTCHandlers = require('./handlers/webrtc/webrtcHandlers');

/**
 * Socket.IO sunucusunu oluşturur ve yapılandırır
 * @param {Object} server - HTTP sunucusu
 * @param {Object} deps - Bağımlılıklar
 * @returns {Object} - Socket.IO sunucusu
 */
function createSocketServer(server, deps) {
  // Redis pubsub için ikinci bir bağlantı oluştur
  const pubClient = redisClient.duplicate();

  // Socket.IO sunucusu oluştur
  const io = socketIO(server, {
    wsEngine: WebSocket.Server,
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 5e6, // 5MB
    // Güvenlik ayarları
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    cookie: {
      name: 'sesli-sohbet.sid',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 gün
    }
  });

  // Redis adapter'i ekle
  io.adapter(createAdapter(pubClient, pubClient.duplicate()));

  // Bellek içi veri yapıları (sadece bu sunucu için)
  const users = {};
  const groups = {};
  const friendRequests = {};

  // Bağımlılıkları birleştir
  const socketDeps = {
    ...deps,
    users,
    groups,
    onlineManager,
    sessionManager,
    io
  };

  // Kimlik doğrulama middleware'i
  io.use(async (socket, next) => {
    try {
      // Token'i al
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Kimlik doğrulama gerekli'));
      }

      // Token'i doğrula (deps.authManager ile)
      const decoded = await deps.authManager.verifyToken(token);

      if (!decoded) {
        return next(new Error('Geçersiz token'));
      }

      // Kullanıcı bilgilerini socket'e ekle
      socket.user = decoded;

      next();
    } catch (error) {
      logger.error('Socket kimlik doğrulama hatası', { error: error.message });
      next(new Error(`Kimlik doğrulama başarısız: ${error.message}`));
    }
  });

  // Bağlantı olayını dinle
  io.on('connection', async (socket) => {
    try {
      logger.info('Yeni bağlantı', { socketId: socket.id, userId: socket.user.sub, username: socket.user.username });

      // Kullanıcı verilerini başlat
      users[socket.id] = {
        userId: socket.user.sub,
        username: socket.user.username,
        currentGroup: null,
        currentRoom: null,
        micEnabled: true,
        selfDeafened: false,
        isScreenSharing: false,
        screenShareProducerId: null
      };

      // Kullanıcıyı çevrimiçi olarak işaretle
      await onlineManager.setUserOnline(socket.user.username, socket.id);

      // Oturum oluştur
      const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
      const ipAddress = socket.handshake.address || 'Unknown';

      const session = await sessionManager.createSession(
        socket.user.sub,
        socket.id,
        userAgent,
        ipAddress
      );

      // Oturum ID'sini socket'e kaydet
      socket.sessionId = session._id.toString();

      // Socket olaylarını kaydet
      registerUserHandlers(socket, io, socketDeps);
      registerSecurityHandlers(socket, io, socketDeps);
      registerGroupHandlers(socket, io, socketDeps);
      registerChannelHandlers(socket, io, socketDeps);
      registerMessageHandlers(socket, io, socketDeps);
      registerDMHandlers(socket, io, socketDeps);
      registerFriendHandlers(socket, io, socketDeps);
      registerMediaHandlers(socket, io, socketDeps);
      registerRoleHandlers(socket, io, socketDeps);
      registerNotificationHandlers(socket, io, socketDeps);
      registerWebRTCHandlers(socket, io, socketDeps);

      // Bağlantı kesme olayını dinle
      socket.on('disconnect', async (reason) => {
        try {
          logger.info('Bağlantı kesildi', { socketId: socket.id, reason, username: socket.user?.username });

          const userData = users[socket.id];
          if (userData) {
            // Kullanıcıyı çevrimdışı olarak işaretle
            if (userData.username) {
              await onlineManager.setUserOffline(userData.username);
            }

            // Oturumu sonlandır
            if (socket.sessionId) {
              await sessionManager.endSessionById(socket.sessionId);
            }

            // Kullanıcıyı gruplardan çıkar
            if (userData.currentGroup) {
              deps.userManager.removeUserFromAllGroupsAndRooms(socket, users, groups);
            }

            // Kullanıcı verilerini temizle
            delete users[socket.id];
          }
        } catch (error) {
          logger.error('Bağlantı kesme hatası', { error: error.message, socketId: socket.id });
        }
      });

      // Hata olayını dinle
      socket.on('error', (error) => {
        logger.error('Socket hatası', { error, socketId: socket.id, username: socket.user?.username });
      });
    } catch (error) {
      logger.error('Bağlantı işleme hatası', { error: error.message, socketId: socket.id });
      socket.disconnect(true);
    }
  });

  // Periyodik temizleme işlemleri

  // Boş grupları temizle (her 15 dakikada bir)
  setInterval(() => {
    try {
      // Boş grupları temizle
      for (const groupId in groups) {
        if (groups[groupId].users && groups[groupId].users.length === 0) {
          delete groups[groupId];
          logger.info('Boş grup temizlendi', { groupId });
        }
      }
    } catch (error) {
      logger.error('Grup temizleme hatası', { error: error.message });
    }
  }, 15 * 60 * 1000); // Her 15 dakika

  // Süresi dolmuş oturumları temizle (her 30 dakikada bir)
  setInterval(async () => {
    try {
      const cleanedCount = await sessionManager.cleanupExpiredSessions(120); // 2 saat inaktif
      if (cleanedCount > 0) {
        logger.info('Süresi dolmuş oturumlar temizlendi', { count: cleanedCount });
      }
    } catch (error) {
      logger.error('Oturum temizleme hatası', { error: error.message });
    }
  }, 30 * 60 * 1000); // Her 30 dakika

  // Bellek kullanımını günlüğe kaydet (her saat)
  setInterval(() => {
    try {
      const memoryUsage = process.memoryUsage();
      logger.info('Bellek kullanımı', {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      });
    } catch (error) {
      logger.error('Bellek kullanımı günlükleme hatası', { error: error.message });
    }
  }, 60 * 60 * 1000); // Her saat

  return io;
}

module.exports = createSocketServer;
