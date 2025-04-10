/**************************************
 * app.ts
 * Ana uygulama dosyası
 **************************************/
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import WebSocket from 'ws';
import mongoose from 'mongoose';
import path from 'path';

// Modeller
import './models/User';
import './models/Group';
import './models/Channel';
import './models/Message';
import './models/DmMessage';
import './models/FileAttachment';
import './models/PasswordReset';
import './models/Role';
import './models/GroupMember';
import './models/Category';
import './models/ScheduledMessage';

// Modüller
import * as sfu from '../sfu';
import * as groupManager from '../modules/groupManager';
import * as channelManager from '../modules/channelManager';
import * as userManager from '../modules/userManager';
import * as friendManager from '../modules/friendManager';
import * as dmManager from '../modules/dmManager';
import * as fileUpload from '../modules/fileUpload';
import * as messageManager from '../modules/messageManager';
import * as profileManager from '../modules/profileManager';
import * as richTextFormatter from '../modules/richTextFormatter';
import * as registerTextChannelEvents from '../modules/textChannel';

// Yeni modüller
import * as passwordReset from '../modules/passwordReset';
import * as emailVerification from '../modules/emailVerification';
import * as twoFactorAuth from '../modules/twoFactorAuth';
import * as roleManager from '../modules/roleManager';
import * as categoryManager from '../modules/categoryManager';
import * as archiveManager from '../modules/archiveManager';
import * as messageInteractions from '../modules/messageInteractions';
import * as mediaProcessor from '../modules/mediaProcessor';
import * as notificationManager from '../modules/notificationManager';
import * as emailNotifications from '../modules/emailNotifications';
import * as scheduledMessageManager from '../modules/scheduledMessageManager';
import * as sessionManager from '../modules/sessionManager';
import * as reportManager from '../modules/reportManager';

// Express uygulaması ve HTTP sunucusu oluştur
const app = express();
const server = http.createServer(app);

// Middleware'ler
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Güvenlik middleware'leri
import { setupSecurityMiddleware } from '../middleware/security';
setupSecurityMiddleware(app);

// Rate limiting middleware'leri
import { apiLimiter, authLimiter } from '../middleware/rateLimit';
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Hata işleyici
import { errorHandler } from '../utils/errors';

// Sağlık kontrolü rotaları
import healthRoutes from '../routes/health';
app.use(healthRoutes);

// Socket.IO sunucusu oluştur
const io = new SocketIOServer(server, {
  wsEngine: WebSocket.Server
});

// Bellek içi veri yapıları
const users: Record<string, any> = {};   // socket.id -> { username, currentGroup, currentRoom, micEnabled, selfDeafened, isScreenSharing, screenShareProducerId }
const groups: Record<string, any> = {};  // groupId -> { owner, name, users:[], rooms:{} }
const onlineUsernames = new Set<string>();
const friendRequests: Record<string, any[]> = {};  // key: hedef kullanıcı adı, value: [ { from, timestamp }, ... ]

// Zamanlanmış görevler
import { startScheduledTasks, stopScheduledTasks } from '../modules/scheduler/scheduledTasks';

// MongoDB bağlantısı
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/sesli-sohbet";

// MongoDB bağlantı seçenekleri
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // IPv4
  maxPoolSize: 10
};

mongoose.connect(uri)
  .then(async () => {
    console.log("MongoDB bağlantısı başarılı!");

    // Mediasoup işçilerini oluştur
    await sfu.createWorkers();
    console.log("Mediasoup Workers hazır!");

    // Grupları ve kanalları yükle
    await groupManager.loadGroupsFromDB(groups);
    await channelManager.loadChannelsFromDB(groups);

    // Redis bağlantısını kontrol et
    try {
      const { redisClient } = require('../config/redis');
      await redisClient.ping();
      console.log("Redis bağlantısı başarılı!");
    } catch (error: any) {
      console.warn("Redis bağlantısı kurulamadı, sahte istemci kullanılıyor:", error.message);
      // Uygulama Redis olmadan da çalışmaya devam edecek
    }

    // Zamanlanmış görevleri başlat
    startScheduledTasks();
    console.log("Zamanlanmış görevler başlatıldı!");

    // Uygulamanın hazır olduğunu işaretle
    app.set('isReady', true);

    console.log("Uygulama başlangıç yüklemeleri tamam.");
  })
  .catch(err => {
    console.error("MongoDB bağlantı hatası:", err);
    process.exit(1); // Kritik bir hata olduğunda uygulamayı sonlandır
  });

// Socket.IO olaylarını yükle
import socketEvents from '../socket/socketEvents';
socketEvents(io, {
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
  registerTextChannelEvents,
  sfu,
  // Yeni modüller
  passwordReset,
  emailVerification,
  twoFactorAuth,
  roleManager,
  categoryManager,
  archiveManager,
  messageInteractions,
  mediaProcessor,
  notificationManager,
  emailNotifications,
  scheduledMessageManager,
  sessionManager,
  reportManager
});

// Zamanlanmış mesajları yönetmek için modülü başlat
scheduledMessageManager.initScheduledMessageManager(io, richTextFormatter);

// API rotalarını ekle
// app.use('/api', apiRoutes);

// 404 hatası için middleware
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Kaynak bulunamadı',
    code: 'NOT_FOUND'
  });
});

// Hata işleyici middleware
app.use(errorHandler);

// Sunucuyu başlat
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

// Graceful shutdown
import { redisClient } from '../config/redis';

async function gracefulShutdown(signal: string) {
  console.log(`${signal} sinyali alındı, sunucu kapatılıyor...`);

  // Uygulamanın hazır olmadığını işaretle
  app.set('isReady', false);

  try {
    // Zamanlanmış görevleri durdur
    stopScheduledTasks();
    console.log('Zamanlanmış görevler durduruldu');

    // Yeni bağlantıları reddet
    server.close(() => {
      console.log('HTTP sunucusu kapatıldı');
    });

    // Redis bağlantısını kapat
    await redisClient.quit();
    console.log('Redis bağlantısı kapatıldı');

    // MongoDB bağlantısını kapat
    await mongoose.connection.close(false);
    console.log('MongoDB bağlantısı kapatıldı');

    // Mediasoup worker'larını kapat
    await sfu.closeWorkers();
    console.log('Mediasoup worker\'ları kapatıldı');

    console.log('Uygulama güvenli bir şekilde kapatıldı');
    process.exit(0);
  } catch (error) {
    console.error('Graceful shutdown sırasında hata:', error);
    process.exit(1);
  }
}

// Sinyal işleyicileri
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('Yakalanmamış istisna:', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Yakalanmamış Promise reddi:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;
