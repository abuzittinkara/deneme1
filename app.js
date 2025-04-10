/**************************************
 * app.js
 * Ana uygulama dosyası
 **************************************/
require('dotenv').config();

const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const WebSocket = require('ws');
const mongoose = require('mongoose');

// Modeller
const User = require('./models/User');
const Group = require('./models/Group');
const Channel = require('./models/Channel');
const Message = require('./models/Message');
const DMMessage = require('./models/DmMessage');
const FileAttachment = require('./models/FileAttachment');
const PasswordReset = require('./models/PasswordReset');
const Role = require('./models/Role');
const GroupMember = require('./models/GroupMember');
const Category = require('./models/Category');
const ScheduledMessage = require('./models/ScheduledMessage');

// Modüller
const sfu = require('./sfu');
const groupManager = require('./modules/groupManager');
const channelManager = require('./modules/channelManager');
const userManager = require('./modules/userManager');
const friendManager = require('./modules/friendManager');
const dmManager = require('./modules/dmManager');
const fileUpload = require('./modules/fileUpload');
const messageManager = require('./modules/messageManager');
const profileManager = require('./modules/profileManager');
const richTextFormatter = require('./modules/richTextFormatter');
const registerTextChannelEvents = require('./modules/textChannel');

// Yeni modüller
const passwordReset = require('./modules/passwordReset');
const emailVerification = require('./modules/emailVerification');
const twoFactorAuth = require('./modules/twoFactorAuth');
const roleManager = require('./modules/roleManager');
const categoryManager = require('./modules/categoryManager');
const archiveManager = require('./modules/archiveManager');
const messageInteractions = require('./modules/messageInteractions');
const mediaProcessor = require('./modules/mediaProcessor');
const notificationManager = require('./modules/notificationManager');
const emailNotifications = require('./modules/emailNotifications');
const scheduledMessageManager = require('./modules/scheduledMessageManager');
const sessionManager = require('./modules/sessionManager');
const reportManager = require('./modules/reportManager');

// Express uygulaması ve HTTP sunucusu oluştur
const app = express();
const server = http.createServer(app);

// Middleware'ler
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Güvenlik middleware'leri
const { setupSecurityMiddleware } = require('./middleware/security');
setupSecurityMiddleware(app);

// Rate limiting middleware'leri
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Hata işleyici
const { errorHandler } = require('./utils/errors');

// Sağlık kontrolü rotaları
const healthRoutes = require('./routes/health');
app.use(healthRoutes);

// Socket.IO sunucusu oluştur
const io = socketIO(server, {
  wsEngine: WebSocket.Server
});

// Bellek içi veri yapıları
const users = {};   // socket.id -> { username, currentGroup, currentRoom, micEnabled, selfDeafened, isScreenSharing, screenShareProducerId }
const groups = {};  // groupId -> { owner, name, users:[], rooms:{} }
const onlineUsernames = new Set();
const friendRequests = {};  // key: hedef kullanıcı adı, value: [ { from, timestamp }, ... ]

// Zamanlanmış görevler
const { startScheduledTasks, stopScheduledTasks } = require('./modules/scheduler/scheduledTasks');

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

mongoose.connect(uri, mongooseOptions)
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
      const { redisClient } = require('./config/redis');
      await redisClient.ping();
      console.log("Redis bağlantısı başarılı!");
    } catch (error) {
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
require('./socket/socketEvents')(io, {
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
app.use((req, res, next) => {
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
const { redisClient } = require('./config/redis');

async function gracefulShutdown(signal) {
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
process.on('unhandledRejection', (reason, promise) => {
  console.error('Yakalanmamış Promise reddi:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
