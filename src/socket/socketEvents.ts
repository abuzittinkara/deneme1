/**
 * src/socket/socketEvents.ts
 * Socket.IO olaylarını yöneten ana modül
 */
import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { TypedSocket, TypedServer } from '../types/socket';
import { registerMessageHandlers } from './handlers/messageHandlers';
import { registerUserHandlers } from './handlers/userHandlers';
import { registerGroupHandlers } from './handlers/groupHandlers';
import { registerFriendHandlers } from './handlers/friendHandlers';
import { registerCallHandlers } from './handlers/callHandlers';
import { registerVoiceHandlers } from './handlers/voiceHandlers';
import { registerMediasoupHandlers } from './handlers/mediasoupHandlers';
import { measurePerformanceAsync } from '../utils/performance';

// Socket.IO olaylarını yöneten ana fonksiyon
const socketEvents = (io: TypedServer, dependencies: any) => {
  // Socket.IO engine bağlantı olaylarını dinle
  io.engine.on('connection', (socket) => {
    logger.info('Socket.IO Engine bağlantısı alındı', {
      socketId: socket.id,
      transport: socket.transport,
    });
  });

  // Socket.IO bağlantı hatalarını dinle
  io.engine.on('error', (err) => {
    logger.error('Socket.IO Engine hatası', { error: err });
  });

  // Socket.IO bağlantı istatistiklerini logla
  setInterval(() => {
    const sockets = io.sockets.sockets;
    const socketCount = sockets.size;
    const rooms = io.sockets.adapter.rooms;
    const roomCount = rooms.size;

    // Aktif odaları ve kullanıcı sayılarını topla
    const activeRooms: Record<string, number> = {};
    rooms.forEach((room, roomId) => {
      // Soket ID'leri ile oda ID'lerini karıştırmamak için kontrol
      if (!roomId.includes('/')) {
        activeRooms[roomId] = room.size;
      }
    });

    // Bağlantı türlerine göre istatistikler
    let pollingCount = 0;
    let websocketCount = 0;
    let totalCount = 0;

    // Engine ve wsEngine kontrolü
    if (io.engine) {
      // io.engine'in clientsCount özelliğini kullan
      totalCount = (io.engine as any).clientsCount || 0;

      // wsEngine özelliğini kontrol et
      if ((io.engine as any).wsEngine) {
        // wsEngine'in clientsCount özelliğini kullan
        websocketCount = ((io.engine as any).wsEngine as any).clientsCount || 0;
        pollingCount = totalCount - websocketCount;
      } else {
        // wsEngine yoksa tüm bağlantıları polling olarak kabul et
        pollingCount = totalCount;
      }
    } else {
      // Engine yoksa soket sayısını kullan
      totalCount = socketCount;
    }

    // Detaylı istatistikleri logla
    logger.info('Socket.IO istatistikleri', {
      socketCount,
      roomCount,
      activeRooms:
        Object.keys(activeRooms).length > 10
          ? { ...Object.fromEntries(Object.entries(activeRooms).slice(0, 10)), more: true }
          : activeRooms,
      connections: {
        total: totalCount,
        polling: pollingCount,
        websocket: websocketCount,
        pollingPercentage: totalCount > 0 ? Math.round((pollingCount / totalCount) * 100) : 0,
        websocketPercentage: totalCount > 0 ? Math.round((websocketCount / totalCount) * 100) : 0,
      },
      timestamp: new Date().toISOString(),
    });
  }, 60000); // Her dakika
  const {
    users,
    groups,
    onlineUsernames,
    friendRequests,
    groupManager,
    channelManager,
    userManager,
    friendManager,
    dmManager,
    fileUpload,
    messageManager,
    profileManager,
    richTextFormatter,
    sfu,
    // Yeni modüller
    passwordReset,
    emailVerification,
    twoFactorAuth,
    roleManager,
    categoryManager,
    archiveManager,
    mediaProcessor,
    notificationManager,
    emailNotifications,
    scheduledMessageManager,
    sessionManager,
    reportManager,
  } = dependencies;

  // Bağlantı olayı
  io.on('connection', (socket: TypedSocket) => {
    logger.info('Socket.IO bağlantısı alındı', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
      remoteAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      query: socket.handshake.query,
      timestamp: new Date().toISOString(),
    });

    // Bağlantı olaylarını dinle
    socket.on('disconnect', (reason) => {
      logger.debug('Socket.IO bağlantısı kesildi', {
        socketId: socket.id,
        reason,
        timestamp: new Date().toISOString(),
      });
    });

    // Geliştirme modunda kimlik doğrulama atlanabilir
    const isDevelopment = process.env.NODE_ENV === 'development' || true; // Geliştirme için her zaman true

    // Token kontrolü
    const token =
      (socket.handshake.auth && socket.handshake.auth['token']) ||
      (socket.handshake.query && (socket.handshake.query['token'] as string));

    // Kullanıcı bilgilerini al
    const userId = (socket.request as any).user?.id;
    const username = (socket.request as any).user?.username;

    // Kimlik bilgileri artık app.ts'deki middleware'de ayarlanıyor
    // Bu değişkenler artık kullanılmıyor, socket.data üzerinden erişiyoruz

    // Geliştirme modunda veya test token'ı varsa kimlik doğrulama atla
    // Bu kısım artık aşağıdaki kimlik doğrulama kontrolünde yapılacak

    // Transport değişikliklerini dinle
    socket.conn.on('upgrade', (transport) => {
      logger.info('Socket.IO transport yükseltildi', {
        socketId: socket.id,
        transport: transport.name,
      });
    });

    // Kimlik doğrulama kontrolü - artık app.ts'deki middleware'de yapılıyor
    // Burada sadece kimlik doğrulama başarılı mesajı gönderiyoruz
    if (socket.data.authenticated) {
      // Kullanıcıya kimlik doğrulama başarılı mesajı gönder
      // 'auth:success' olayını özel olarak tanımla
      (socket as any).emit('auth:success', {
        userId: socket.data.userId,
        username: socket.data.username,
        message: 'Socket.IO bağlantısı başarılı',
      });

      logger.info('Socket.IO kimlik doğrulama başarılı', {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
      });
    } else {
      // Bu duruma düşmemesi gerekir, çünkü middleware'de kontrol edildi
      logger.warn('Kimliği doğrulanmamış bağlantı girişimi (beklenmeyen durum)', {
        socketId: socket.id,
      });
      // 'auth:error' olayını özel olarak tanımla
      (socket as any).emit('auth:error', { message: 'Yetkilendirme hatası', code: 'AUTH_ERROR' });
      socket.disconnect(true);
      return;
    }

    // Soket verisini ayarla (eğer zaten ayarlanmadıysa)
    // Bu kısım artık yukarıdaki kimlik doğrulama kontrolünde yapılıyor

    logger.info('Kullanıcı bağlandı', {
      userId: socket.data.userId,
      username: socket.data.username,
      socketId: socket.id,
    });

    // Kullanıcıyı çevrimiçi olarak işaretle
    // socket.data'dan kimlik bilgilerini al

    if (!users[socket.data.userId]) {
      users[socket.data.userId] = [];
    }
    users[socket.data.userId].push(socket.id);
    onlineUsernames[socket.data.userId] = socket.data.username;

    // Kullanıcı durumunu güncelle
    if (typeof userManager.updateUserStatus === 'function') {
      userManager.updateUserStatus(socket.data.userId, 'online').catch((err) =>
        logger.error('Kullanıcı durumu güncelleme hatası', {
          error: err.message,
          userId: socket.data.userId,
        })
      );
    } else {
      logger.warn('userManager.updateUserStatus fonksiyonu bulunamadı', {
        userId: socket.data.userId,
        username: socket.data.username,
      });
    }

    // Kullanıcının bağlantı durumunu bildir
    socket.broadcast.emit('user:connect', {
      userId: socket.data.userId,
      username: socket.data.username,
    });

    // Çevrimiçi kullanıcıları gönder
    socket.emit('users:online', onlineUsernames);

    // Kullanıcının gruplarına katıl
    measurePerformanceAsync(async () => {
      try {
        // Geliştirme modunda grupları atla
        if (process.env.NODE_ENV === 'development') {
          // Geliştirme modunda sahte grup odalarına katıl
          socket.join('dev-group-1');
          socket.join('dev-channel-1');
          socket.join('dev-channel-2');

          logger.info('Geliştirme modunda sahte gruplara katıldı', {
            userId: socket.data.userId,
            username: socket.data.username,
          });
          return;
        }

        // Üretim modunda gerçek grupları kullan
        if (typeof groupManager.getUserGroups === 'function') {
          const userGroups = await groupManager.getUserGroups(socket.data.userId);

          for (const group of userGroups) {
            // Grup odasına katıl
            socket.join(group._id.toString());
            socket.data.currentGroup = group._id.toString();

            // Gruptaki tüm kanallara katıl
            for (const channel of group.channels) {
              socket.join(channel._id.toString());
            }
          }

          logger.info('Kullanıcı gruplarına katıldı', {
            userId: socket.data.userId,
            username: socket.data.username,
            groupCount: userGroups.length,
          });
        } else {
          logger.warn('groupManager.getUserGroups fonksiyonu bulunamadı', {
            userId: socket.data.userId,
            username: socket.data.username,
          });
        }
      } catch (error) {
        logger.error('Kullanıcı gruplarına katılma hatası', {
          error: (error as Error).message,
          userId: socket.data.userId,
          username: socket.data.username,
        });
      }
    }, 'Kullanıcı gruplarına katılma');

    // Kullanıcının DM kanallarına katıl
    measurePerformanceAsync(async () => {
      try {
        // Geliştirme modunda DM kanallarını atla
        if (process.env.NODE_ENV === 'development') {
          // Geliştirme modunda sahte DM odalarına katıl
          socket.join('dev-dm-1');
          socket.join('dev-dm-2');

          logger.info('Geliştirme modunda sahte DM kanallarına katıldı', {
            userId: socket.data.userId,
            username: socket.data.username,
          });
          return;
        }

        // Üretim modunda gerçek DM kanallarını kullan
        if (typeof dmManager.getUserDMs === 'function') {
          const userDMs = await dmManager.getUserDMs(socket.data.userId);

          for (const dm of userDMs) {
            socket.join(dm._id.toString());
          }

          logger.info('Kullanıcı DM kanallarına katıldı', {
            userId: socket.data.userId,
            username: socket.data.username,
            dmCount: userDMs.length,
          });
        } else {
          logger.warn('dmManager.getUserDMs fonksiyonu bulunamadı', {
            userId: socket.data.userId,
            username: socket.data.username,
          });
        }
      } catch (error) {
        logger.error('Kullanıcı DM kanallarına katılma hatası', {
          error: (error as Error).message,
          userId: socket.data.userId,
          username: socket.data.username,
        });
      }
    }, 'Kullanıcı DM kanallarına katılma');

    // Olay işleyicilerini kaydet
    registerMessageHandlers(socket, dependencies);
    registerUserHandlers(socket, dependencies);
    registerGroupHandlers(socket, dependencies);
    registerFriendHandlers(socket, dependencies);
    registerCallHandlers(socket, dependencies);
    registerVoiceHandlers(socket, dependencies);
    registerMediasoupHandlers(socket, dependencies);

    // Hata olayı
    socket.on('error', (error: any) => {
      logger.error('Socket hatası', {
        error,
        userId: socket.data.userId,
        username: socket.data.username,
        socketId: socket.id,
      });
    });
  });

  logger.info('Socket.IO olayları başlatıldı');

  return io;
};

export default socketEvents;
