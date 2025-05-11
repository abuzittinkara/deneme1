/**
 * src/app.ts
 * Ana uygulama dosyası
 */
import dotenv from 'dotenv';
dotenv.config();

// Path alias desteğini yükle
import './paths';

// Güvenlik yardımcı fonksiyonlarını içe aktar
import { validateFilePath } from './utils/securityUtils';

import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
// Loglama ve hata izleme
import { logger, requestLogger } from './utils/logger';
import {
  errorHandler,
  notFoundHandler,
  setupUncaughtExceptionHandlers,
} from './middleware/advancedErrorHandler';
import sentryHandler from './middleware/sentryHandler';
import { startErrorTracking } from './utils/errorReporter';

// Modeller
// Geçici olarak devre dışı bırakıldı, çünkü başka bir yerde import edilmiş olabilir
// import './models/User';
// import './models/Group';
// import './models/Channel';
// import './models/Message';
// import './models/DirectMessage';
// import './models/FileAttachment';
// import './models/Role';
// import './models/GroupMember';
// import './models/Category';
// import './models/ScheduledMessage';
// import './models/Session';
// import './models/PasswordReset';
// import './models/UserActivity';
// import './models/Webhook';

// Modüller
import * as sfu from './sfu';
import * as groupManager from './modules/groupManager';
import * as channelManager from './modules/channelManager';
import * as userManager from './modules/userManager';
import * as friendManager from './modules/user/friendManager';
import * as dmManager from './modules/dmManager';
import * as fileUpload from './modules/fileUpload';
import * as messageManager from './modules/message/messageManager';
import * as profileManager from './modules/profileManager';
import * as richTextFormatter from './modules/richTextFormatter';
import registerTextChannelEvents from './modules/textChannel';
import { CallManager } from './services/callManager';

// Servisler
import { userService } from './services/userService';
import { groupService } from './services/groupService';
import { channelService } from './services/channelService';
import { messageService } from './services/messageService';
import { WebRTCService } from './services/webrtcService';

// Yeni modüller
import * as passwordReset from './modules/passwordReset';
import * as emailVerification from './modules/emailVerification';
import * as twoFactorAuth from './modules/twoFactorAuth';
import * as roleManager from './modules/roleManager';
import * as categoryManager from './modules/categoryManager';
import * as archiveManager from './modules/archiveManager';
import * as messageInteractions from './modules/messageInteractions';
import * as mediaProcessor from './modules/mediaProcessor';
import * as notificationManager from './modules/notificationManager';
import * as emailNotifications from './modules/emailNotifications';
import * as scheduledMessageManager from './modules/scheduledMessageManager';
import * as sessionManager from './modules/session/sessionManager';
import * as reportManager from './modules/reportManager';

// Yakalanmamış hata işleyicilerini kur
setupUncaughtExceptionHandlers();

// Hata izleme sistemini başlat
startErrorTracking();

// Express uygulaması ve HTTP sunucusu oluştur
const app = express();
const server = http.createServer(app);

// Sentry'yi yapılandır ve başlat
sentryHandler.setupSentry(app);

// İstek ID middleware'i
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Sentry istek işleme middleware'i
app.use(sentryHandler.sentryRequestHandler);
app.use(sentryHandler.sentryTracingHandler);

// Cookie parser middleware'i artık security.ts içinde yapılandırılıyor

// İzleme middleware'leri
import monitoringMiddleware from './middleware/monitoringMiddleware';
monitoringMiddleware.setupMonitoringMiddleware(app);

// Bakım modu middleware'i
import maintenanceMode from './middleware/maintenanceMode';
app.use((req, res, next) => {
  maintenanceMode.maintenanceModeMiddleware({
    allowedIPs: ['127.0.0.1', '::1'], // Localhost IP'leri
    allowedPaths: ['/api/health', '/api/health/detailed', '/api/auth/login'], // Her zaman erişilebilir yollar
  })(req, res, next);
});

// Çoklu dil desteği middleware'i
import { i18nMiddleware } from './middleware/i18nMiddleware';
app.use(i18nMiddleware);

// Tema middleware'i
import { themeMiddleware, themeCSS } from './middleware/themeMiddleware';
app.use(themeMiddleware);
// TypeScript ile Express 4.x'te middleware kullanımı için düzeltme
import { createRouteHandler } from './utils/express-helpers';
app.get('/css/theme.css', createRouteHandler(themeCSS));

// Loglama middleware'i
app.use(requestLogger);

// Performans izleme
import { setupPerformanceMiddleware } from './middleware/performanceMiddleware';
import { startPerformanceTracking } from './utils/performanceTracker';
import performanceMonitorService from './services/performanceMonitorService';

// Performans middleware'lerini yapılandır
setupPerformanceMiddleware(app);

// Performans izlemeyi başlat
startPerformanceTracking();

// Performans izleme servisini başlat
performanceMonitorService.startMonitoring({
  samplingInterval: 60000, // 1 dakika
  metricsLimit: 10000, // 10000 metrik
});

// CORS middleware'i artık security.ts içinde yapılandırılıyor

// Middleware'ler
// Güvenli statik dosya sunumu
const publicPath = path.resolve(path.join(__dirname, '../public'));
// Yol güvenliği kontrolü
if (!fs.existsSync(publicPath)) {
  logger.error('Public dizini bulunamadı', { path: publicPath });
  throw new Error('Public dizini bulunamadı');
}
app.use(
  express.static(publicPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    },
  })
);

// Derlenen dosyaları sun
const distPublicPath = path.resolve(path.join(__dirname, '../dist/public'));
// Yol güvenliği kontrolü
if (!fs.existsSync(distPublicPath)) {
  logger.warn('Dist/public dizini bulunamadı, derleme yapılmamış olabilir', {
    path: distPublicPath,
  });
  // Kritik bir hata değil, devam et
} else {
  app.use(
    express.static(distPublicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      },
    })
  );
}

// Güvenli uploads dizini sunumu
const uploadsPath = path.resolve(path.join(__dirname, '../uploads'));
// Yol güvenliği kontrolü
if (!fs.existsSync(uploadsPath)) {
  logger.warn('Uploads dizini bulunamadı, oluşturuluyor', { path: uploadsPath });
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
  } catch (error) {
    logger.error('Uploads dizini oluşturulamadı', { error: (error as Error).message });
  }
}

app.use(
  '/uploads',
  (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    try {
      // Kullanıcı tarafından sağlanan yolu doğrula
      const requestedPath = req.path;

      // Yol geçişi saldırılarına karşı kontrol et
      if (
        requestedPath.includes('..') ||
        requestedPath.includes('~') ||
        requestedPath.includes('%2e')
      ) {
        logger.warn('Uploads dizinine şüpheli erişim girişimi', {
          path: requestedPath,
          ip: req.ip,
        });
        res.status(403).send('Geçersiz dosya yolu');
        return;
      }

      // Tam dosya yolunu oluştur ve doğrula
      const fullPath = path.join(uploadsPath, requestedPath);
      if (!fullPath.startsWith(uploadsPath)) {
        logger.warn('Uploads dizini dışına erişim girişimi', {
          path: requestedPath,
          fullPath,
          ip: req.ip,
        });
        res.status(403).send('Geçersiz dosya yolu');
        return;
      }

      next();
    } catch (error) {
      logger.error('Uploads dizini erişim hatası', {
        error: (error as Error).message,
        path: req.path,
      });
      res.status(403).send('Geçersiz dosya yolu');
      return;
    }
  },
  express.static(uploadsPath)
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Yardım sayfası için özel rotalar
const helpRouteHandler = (req: express.Request, res: express.Response): void => {
  try {
    // Güvenli bir şekilde dosya yolunu oluştur
    const helpFilePath = path.resolve(path.join(__dirname, '../public/help.html'));

    // Dosya yolunu doğrula
    if (!helpFilePath.startsWith(publicPath)) {
      logger.error('Geçersiz yardım dosyası yolu', { path: helpFilePath, publicPath });
      res.status(404).send('Sayfa bulunamadı');
      return;
    }

    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(helpFilePath)) {
      logger.error('Yardım dosyası bulunamadı', { path: helpFilePath });
      res.status(404).send('Sayfa bulunamadı');
      return;
    }

    res.sendFile(helpFilePath);
  } catch (error) {
    logger.error('Yardım sayfası erişim hatası', { error: (error as Error).message });
    res.status(500).send('Sunucu hatası');
  }
};

// Her iki URL için de aynı işleyiciyi kullan
app.get('/help', helpRouteHandler);
app.get('/help.html', helpRouteHandler);

// Sanitizasyon middleware'leri
import { sanitizeRequest } from './middleware/sanitizationMiddleware';
app.use(sanitizeRequest);

// Güvenlik middleware'leri
import { setupSecurityMiddleware } from './middleware/security';

// Güvenlik middleware'lerini uygula
setupSecurityMiddleware(app);

// Sentry kullanıcı bağlamı middleware'i (kimlik doğrulama middleware'inden sonra kullanılmalı)
app.use(sentryHandler.sentryUserContext);

// Hata işleme middleware'leri app.ts sonunda kurulacak

// Sağlık kontrolü rotaları
import healthRoutes from './routes/health';
app.use(healthRoutes);

// Performans izleme rotaları
import performanceRoutes from './routes/performance';
app.use(performanceRoutes);

// Hata izleme rotaları
import errorRoutes from './routes/errors';
app.use(errorRoutes);

// Bellek izleme rotaları
import memoryRoutes from './routes/memory';
app.use(memoryRoutes);

// Veritabanı izleme rotaları
import databaseRoutes from './routes/database';
app.use(databaseRoutes);

// Yapılandırma yönetimi rotaları
import configRoutes from './routes/config';
app.use(configRoutes);

// Profilleme rotaları
import profilingRoutes from './routes/profiling';
app.use(profilingRoutes);

// Güvenlik denetimi rotaları
import securityRoutes from './routes/security';
app.use(securityRoutes);

// Socket.IO sunucusu oluştur
import { configureSocketServer } from './socket/socketConfig';
import { registerSocketHandlers } from './socket/socketHandlers';
const io = configureSocketServer(server);

// Görüntülü görüşme yöneticisini oluştur
const callManager = new CallManager(io);

// WebRTC servisini oluştur
import { WebRTCService } from './services/webrtcService';
const webRTCService = new WebRTCService(io);

// Servisleri uygulamaya ekle
app.locals.userService = userService;
app.locals.groupService = groupService;
app.locals.channelService = channelService;
app.locals.messageService = messageService;
app.locals.callManager = callManager;
app.locals.webRTCService = webRTCService;

// Socket.IO olay işleyicilerini kaydet
registerSocketHandlers(io, {
  callManager,
  sfu,
  userManager,
  groupManager,
  channelManager,
  userService,
  groupService,
  channelService,
  messageService,
  webRTCService,
});

// Bellek içi veri yapıları
import { memoryStore } from './utils/memoryStore';
const users = memoryStore.getUsers();
const groups = memoryStore.getGroups();
const onlineUsernames = memoryStore.getOnlineUsernames();
const friendRequests = memoryStore.getFriendRequests();

// Zamanlanmış görevler
import { startScheduledTasks, stopScheduledTasks } from './modules/scheduler/scheduledTasks';

// Veritabanı bağlantıları
import databaseService from './services/databaseService';
import atlasSQL from './config/atlasSQL';
import { atlasSQLService } from './services/atlasSQLService';

// MongoDB bağlantısını kur
if (process.env.NODE_ENV === 'production') {
  databaseService.connect().catch((err) => {
    logger.error('MongoDB bağlantı hatası', { error: err.message });
    sentryHandler.sentryReportError(err as Error, { context: 'MongoDB connection' });
  });
} else {
  // Geliştirme modunda MongoDB bağlantısını kur
  logger.info('Geliştirme modunda MongoDB bağlantısı kuruluyor...');
  databaseService
    .connect()
    .then(() => {
      logger.info('Geliştirme modunda MongoDB bağlantısı başarılı!');
    })
    .catch((err) => {
      logger.error('Geliştirme modunda MongoDB bağlantı hatası', { error: err.message });

      // Bağlantı başarısız olursa mongoose bağlantısını mockla
      if (process.env.NODE_ENV === 'development') {
        logger.info('MongoDB bağlantısı mocklanıyor...');
        // @ts-ignore - readyState özelliği salt okunur olarak tanımlanmış, ancak test için değiştiriyoruz
        mongoose.connection.readyState = 1; // 1 = connected
      }
    });
}

// Geliştirme modunda sahte veri oluştur
if (process.env.NODE_ENV === 'development') {
  // Sahte veri modülünü içe aktar
  import('./utils/mockData')
    .then((mockData) => {
      // Sahte verileri oluştur
      const { users: mockUsers, groups: mockGroups } = mockData.createAllMockData();

      // Sahte kullanıcıları ekle
      Object.keys(mockUsers).forEach((userId) => {
        const mockUser = mockUsers[userId];
        if (mockUser) {
          users[userId] = mockUser;
        }
      });

      // Sahte grupları ekle
      Object.keys(mockGroups).forEach((groupId) => {
        const mockGroup = mockGroups[groupId];
        if (mockGroup) {
          groups[groupId] = mockGroup;
        }
      });

      logger.info('Geliştirme modu için sahte veriler oluşturuldu');
    })
    .catch((err) => {
      logger.error('Sahte veri oluşturulurken hata oluştu', { error: err.message });
    });
}

// Mediasoup işçilerini oluştur
async function initMediasoup() {
  try {
    // Eski SFU modülü
    await sfu.createWorkers();
    logger.info('Mediasoup Workers (SFU) hazır!');

    // Yeni WebRTC servisi
    await webRTCService.createWorkers();
    logger.info('Mediasoup Workers (WebRTC) hazır!');

    return true;
  } catch (error) {
    logger.warn('Mediasoup Workers oluşturulamadı', { error: (error as Error).message });
    return false;
  }
}

// Grupları ve kanalları yükle
async function loadGroupsAndChannels() {
  try {
    logger.info('Gruplar ve kanallar yükleniyor...');

    // Önce bellek içi veri yapılarını veritabanından yükle
    await memoryStore.loadFromDatabase();

    // Grupları yükle (tip güvenli şekilde)
    await groupManager.loadGroupsFromDB(memoryStore.getGroupsInternal());
    logger.info('Gruplar yüklendi');

    // Kanalları yükle (tip güvenli şekilde)
    await channelManager.loadChannelsFromDB(memoryStore.getGroupsInternal());
    logger.info('Kanallar yüklendi');

    logger.info('Gruplar ve kanallar başarıyla yüklendi');
    return true;
  } catch (error) {
    logger.error('Gruplar ve kanallar yüklenirken hata oluştu', {
      error: (error as Error).message,
    });
    return false;
  }
}

// Redis bağlantısını kontrol et - geçici olarak devre dışı bırakıldı
async function initRedis() {
  // Geliştirme modunda Redis'i atla
  logger.info('Geliştirme/test modunda Redis devre dışı bırakıldı, sahte istemci kullanılıyor');
  return true;

  /* Redis bağlantısı gerektiğinde bu kodu aktif edin
  try {
    const { redisClient, redisConnectionManager } = require('./config/redis');
    await redisClient.ping();
    logger.info("Redis bağlantısı başarılı!");

    // Redis bağlantı durumu değişikliklerini dinle
    redisConnectionManager.onStateChange((state: string) => {
      logger.info(`Redis bağlantı durumu değişti: ${state}`);
    });
    return true;
  } catch (error: any) {
    logger.warn("Redis bağlantısı kurulamadı, sahte istemci kullanılıyor", { error: error.message });
    // Uygulama Redis olmadan da çalışmaya devam edecek
    return false;
  }
  */
}

/**
 * Uygulama başlatma durumu
 */
const appInitState = {
  isInitializing: false,
  isInitialized: false,
  startTime: 0,
  initSteps: {
    database: false,
    atlasSQL: false,
    mediasoup: false,
    groups: false,
    redis: false,
    scheduledTasks: false,
    performance: false,
  },
  errors: [] as { step: string; error: string }[],
};

/**
 * Uygulama başlatma sırası
 * @returns Başlatma başarılı mı
 */
async function initializeApp() {
  try {
    // Eğer zaten başlatılıyorsa veya başlatılmışsa, tekrar başlatma
    if (appInitState.isInitializing) {
      logger.info('Uygulama zaten başlatılıyor...');
      return true;
    }

    if (appInitState.isInitialized) {
      logger.info('Uygulama zaten başlatılmış.');
      return true;
    }

    // Başlatma durumunu güncelle
    appInitState.isInitializing = true;
    appInitState.startTime = Date.now();
    appInitState.errors = [];

    logger.info('Uygulama başlatılıyor...');

    // 1. Veritabanı bağlantısını kur
    try {
      await databaseService.connect();
      appInitState.initSteps.database = true;
      logger.info('Veritabanı bağlantısı kuruldu');
    } catch (error) {
      appInitState.errors.push({
        step: 'database',
        error: (error as Error).message,
      });
      logger.error('Veritabanı bağlantısı kurulamadı', { error: (error as Error).message });
      // Veritabanı hatası kritik değil, devam et
    }

    // 1.1. Atlas SQL bağlantısını kur
    try {
      if (process.env.ATLAS_SQL_ENABLED === 'true') {
        await atlasSQLService.connect();
        appInitState.initSteps.atlasSQL = true;
        logger.info('Atlas SQL bağlantısı kuruldu');
      } else {
        logger.info('Atlas SQL devre dışı bırakıldı, bağlantı kurulmayacak');
        appInitState.initSteps.atlasSQL = true;
      }
    } catch (error) {
      appInitState.errors.push({
        step: 'atlasSQL',
        error: (error as Error).message,
      });
      logger.error('Atlas SQL bağlantısı kurulamadı', { error: (error as Error).message });
      // Atlas SQL hatası kritik değil, devam et
    }

    // 2. Mediasoup işçilerini oluştur
    try {
      await initMediasoup();
      appInitState.initSteps.mediasoup = true;
    } catch (error) {
      appInitState.errors.push({
        step: 'mediasoup',
        error: (error as Error).message,
      });
      logger.error('Mediasoup işçileri oluşturulamadı', { error: (error as Error).message });
      // Mediasoup hatası kritik değil, devam et
    }

    // 3. Grupları ve kanalları yükle
    try {
      await loadGroupsAndChannels();
      appInitState.initSteps.groups = true;
    } catch (error) {
      appInitState.errors.push({
        step: 'groups',
        error: (error as Error).message,
      });
      logger.error('Gruplar ve kanallar yüklenemedi', { error: (error as Error).message });
      // Grup yükleme hatası kritik değil, devam et
    }

    // 4. Redis bağlantısını kontrol et
    try {
      await initRedis();
      appInitState.initSteps.redis = true;
    } catch (error) {
      appInitState.errors.push({
        step: 'redis',
        error: (error as Error).message,
      });
      logger.error('Redis bağlantısı kurulamadı', { error: (error as Error).message });
      // Redis hatası kritik değil, devam et
    }

    // 5. Zamanlanmış görevleri başlat
    try {
      startScheduledTasks();
      appInitState.initSteps.scheduledTasks = true;
      logger.info('Zamanlanmış görevler başlatıldı!');
    } catch (error) {
      appInitState.errors.push({
        step: 'scheduledTasks',
        error: (error as Error).message,
      });
      logger.error('Zamanlanmış görevler başlatılamadı', { error: (error as Error).message });
      // Zamanlanmış görev hatası kritik değil, devam et
    }

    // 6. Performans izlemeyi başlat
    try {
      startPerformanceTracking();
      appInitState.initSteps.performance = true;
    } catch (error) {
      appInitState.errors.push({
        step: 'performance',
        error: (error as Error).message,
      });
      logger.error('Performans izleme başlatılamadı', { error: (error as Error).message });
      // Performans izleme hatası kritik değil, devam et
    }

    // 7. Uygulamanın hazır olduğunu işaretle
    app.set('isReady', true);
    appInitState.isInitializing = false;
    appInitState.isInitialized = true;

    const initDuration = Date.now() - appInitState.startTime;
    logger.info(`Uygulama başlangıç yüklemeleri tamam (${initDuration}ms).`, {
      steps: appInitState.initSteps,
      errors: appInitState.errors.length > 0 ? appInitState.errors : undefined,
    });

    return appInitState.errors.length === 0;
  } catch (error) {
    appInitState.isInitializing = false;
    logger.error('Uygulama başlatma hatası', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return false;
  }
}

/**
 * Uygulama başlatma durumunu getirir
 * @returns Başlatma durumu
 */
export function getAppInitState() {
  return {
    ...appInitState,
    uptime: appInitState.startTime > 0 ? Date.now() - appInitState.startTime : 0,
  };
}

// Uygulamayı başlat
initializeApp();

// Sentry'ye uygulama başlangıç bilgisini ekle
sentryHandler.sentryAddBreadcrumb({
  category: 'app',
  message: 'Uygulama başarıyla başlatıldı',
  level: 'info',
});

// Hata işleme middleware'leri app.use ile kuruldu

// Socket.IO olaylarını yükle
import socketEvents from './socket/socketEvents';

// Socket.IO olayları socketConfig.ts içinde yapılandırıldı

logger.info('Socket.IO olayları başlatıldı');

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
  reportManager,
  // WebRTC ve görüşme servisleri
  webRTCService,
  callManager,
});

// Zamanlanmış mesajları yönetmek için modülü başlat
scheduledMessageManager.initScheduledMessageManager(io, richTextFormatter);

// Swagger API dokümantasyonunu ekle
import { setupSwagger } from './config/swagger';
setupSwagger(app);

// API rotalarını ekle
import apiRoutes from './routes/api';
app.use('/api', apiRoutes);

// Auth rotalarını ekle
// import authRoutes from './routes/auth';
// app.use('/api/auth', authRoutes);

// Dil değiştirme rotası
import { changeLanguageMiddleware } from './middleware/i18nMiddleware';
// TypeScript ile Express 4.x'te middleware kullanımı için düzeltme
app.post(
  '/api/language',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    changeLanguageMiddleware(req, res, next);
  }
);

// Tema değiştirme rotası
import { changeThemeMiddleware } from './middleware/themeMiddleware';
// TypeScript ile Express 4.x'te middleware kullanımı için düzeltme
app.post(
  '/api/theme',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    changeThemeMiddleware(req, res, next);
  }
);

// Ana sayfa için özel rota
app.get('/', (req: express.Request, res: express.Response): void => {
  try {
    // Güvenli bir şekilde dosya yolunu oluştur
    const indexFilePath = path.resolve(path.join(__dirname, '../public/index.html'));

    // Dosya yolunu doğrula
    if (!indexFilePath.startsWith(publicPath)) {
      logger.error('Geçersiz index dosyası yolu', { path: indexFilePath, publicPath });
      res.status(404).send('Sayfa bulunamadı');
      return;
    }

    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(indexFilePath)) {
      logger.error('Index dosyası bulunamadı', { path: indexFilePath });
      res.status(404).send('Sayfa bulunamadı');
      return;
    }

    res.sendFile(indexFilePath);
  } catch (error) {
    logger.error('Ana sayfa erişim hatası', { error: (error as Error).message });
    res.status(500).send('Sunucu hatası');
  }
});

// Yardım sayfası rotası daha önce tanımlandı (satır 254-282)

// 404 hatası için middleware
app.use(notFoundHandler);

// Sentry hata işleyici middleware
app.use(sentryHandler.sentryErrorHandler);

// Hata işleyici middleware
app.use(errorHandler);

// Sunucuyu başlat
const PORT = parseInt(process.env['PORT'] || '8888', 10);
logger.info(`PORT değeri: ${PORT}, process.env.PORT: ${process.env['PORT']}`);

// Prevent server from starting in test environment
if (process.env['NODE_ENV'] !== 'test') {
  try {
    server.listen(PORT, () => {
      logger.info(`Sunucu çalışıyor: http://localhost:${PORT}`);

      if (process.env['NODE_ENV'] === 'development') {
        console.log(`Sunucu başarıyla başlatıldı: http://localhost:${PORT}`);
      }

      sentryHandler.sentryAddBreadcrumb({
        category: 'server',
        message: `Sunucu ${PORT} portunda başlatıldı`,
        level: 'info',
      });
    });
  } catch (error) {
    logger.error('Sunucu başlatılırken hata oluştu', { error });
    sentryHandler.sentryReportError(error as Error, { context: 'Server startup' });
  }
}

/**
 * Graceful shutdown durumu
 */
const shutdownState = {
  isShuttingDown: false,
  shutdownStartTime: 0,
  shutdownTimeout: 30000, // 30 saniye
  shutdownSteps: {
    scheduledTasks: false,
    scheduledMessages: false,
    socketIO: false,
    httpServer: false,
    redis: false,
    database: false,
    atlasSQL: false,
    mediasoup: false,
    sentry: false,
  },
  errors: [] as { step: string; error: string }[],
};

/**
 * Graceful shutdown işlemi
 * @param signal - Sinyal adı
 */
async function gracefulShutdown(signal: string) {
  // Eğer zaten kapatılıyorsa, tekrar kapatma
  if (shutdownState.isShuttingDown) {
    logger.warn(`${signal} sinyali alındı, ancak uygulama zaten kapatılıyor...`);
    return;
  }

  // Kapatma durumunu güncelle
  shutdownState.isShuttingDown = true;
  shutdownState.shutdownStartTime = Date.now();
  shutdownState.errors = [];

  logger.info(`${signal} sinyali alındı, sunucu kapatılıyor...`);

  // Sentry'ye kapatma bilgisini ekle
  sentryHandler.sentryAddBreadcrumb({
    category: 'app',
    message: `Graceful shutdown başlatıldı: ${signal}`,
    level: 'info',
  });

  // Uygulamanın hazır olmadığını işaretle
  app.set('isReady', false);

  // Kapatma zaman aşımı
  const shutdownTimeout = setTimeout(() => {
    logger.error(`Graceful shutdown zaman aşımına uğradı (${shutdownState.shutdownTimeout}ms)`);
    process.exit(1);
  }, shutdownState.shutdownTimeout);

  try {
    // 1. Zamanlanmış görevleri durdur
    try {
      stopScheduledTasks();
      shutdownState.shutdownSteps.scheduledTasks = true;
      logger.info('Zamanlanmış görevler durduruldu');
    } catch (error) {
      shutdownState.errors.push({
        step: 'scheduledTasks',
        error: (error as Error).message,
      });
      logger.error('Zamanlanmış görevleri durdurma hatası', { error: (error as Error).message });
    }

    // 2. Zamanlanmış mesaj yöneticisini durdur
    try {
      scheduledMessageManager.stopScheduledMessageManager();
      shutdownState.shutdownSteps.scheduledMessages = true;
      logger.info('Zamanlanmış mesaj yöneticisi durduruldu');
    } catch (error) {
      shutdownState.errors.push({
        step: 'scheduledMessages',
        error: (error as Error).message,
      });
      logger.error('Zamanlanmış mesaj yöneticisini durdurma hatası', {
        error: (error as Error).message,
      });
    }

    // 3. Socket.IO bağlantılarını kapat
    try {
      // Tüm istemcilere kapatma bildirimi gönder
      io.emit('server:shutdown', {
        message: 'Sunucu kapatılıyor, lütfen daha sonra tekrar bağlanın',
        timestamp: new Date().toISOString(),
      });

      // Tüm Socket.IO bağlantılarını kapat
      io.disconnectSockets(true);
      shutdownState.shutdownSteps.socketIO = true;
      logger.info('Socket.IO bağlantıları kapatıldı');
    } catch (error) {
      shutdownState.errors.push({
        step: 'socketIO',
        error: (error as Error).message,
      });
      logger.error('Socket.IO bağlantılarını kapatma hatası', { error: (error as Error).message });
    }

    // 4. HTTP sunucusunu kapat
    try {
      await new Promise<void>((resolve) => {
        server.close(() => {
          shutdownState.shutdownSteps.httpServer = true;
          logger.info('HTTP sunucusu kapatıldı');
          resolve();
        });
      });
    } catch (error) {
      shutdownState.errors.push({
        step: 'httpServer',
        error: (error as Error).message,
      });
      logger.error('HTTP sunucusunu kapatma hatası', { error: (error as Error).message });
    }

    // 5. Redis bağlantısını kapat
    try {
      // Redis bağlantısını kapat - geçici olarak devre dışı bırakıldı
      // await redisClient.quit();
      shutdownState.shutdownSteps.redis = true;
      logger.info('Redis bağlantısı atlandı (geliştirme/test modu)');
    } catch (error) {
      shutdownState.errors.push({
        step: 'redis',
        error: (error as Error).message,
      });
      logger.error('Redis bağlantısını kapatma hatası', { error: (error as Error).message });
    }

    // 6. MongoDB bağlantısını kapat
    try {
      if (process.env['NODE_ENV'] === 'production') {
        await database.disconnectFromDatabase();
        logger.info('MongoDB bağlantısı kapatıldı');
      } else {
        logger.info('Geliştirme modunda MongoDB bağlantısı kapatma atlandı');
      }
      shutdownState.shutdownSteps.database = true;
    } catch (error) {
      shutdownState.errors.push({
        step: 'database',
        error: (error as Error).message,
      });
      logger.error('MongoDB bağlantısını kapatma hatası', { error: (error as Error).message });
    }

    // 6.1. Atlas SQL bağlantısını kapat
    try {
      await atlasSQLService.disconnect();
      logger.info('Atlas SQL bağlantısı kapatıldı');
      shutdownState.shutdownSteps.atlasSQL = true;
    } catch (error) {
      shutdownState.errors.push({
        step: 'atlasSQL',
        error: (error as Error).message,
      });
      logger.error('Atlas SQL bağlantısını kapatma hatası', { error: (error as Error).message });
    }

    // 7. Mediasoup worker'larını kapat
    try {
      // Eski SFU modülü
      await sfu.closeWorkers();

      // Yeni WebRTC servisi
      await webRTCService.close();

      shutdownState.shutdownSteps.mediasoup = true;
      logger.info('Mediasoup worker\'ları kapatıldı');
    } catch (error) {
      shutdownState.errors.push({
        step: 'mediasoup',
        error: (error as Error).message,
      });
      logger.warn('Mediasoup worker\'ları kapatılamadı', { error: (error as Error).message });
    }

    // 8. Sentry'yi kapat (son işlem olarak)
    try {
      if (process.env['SENTRY_DSN']) {
        logger.info('Sentry kapatılıyor...');
        await import('@sentry/node').then((Sentry) => Sentry.close(2000)); // 2 saniye bekle
      }
      shutdownState.shutdownSteps.sentry = true;
    } catch (error) {
      shutdownState.errors.push({
        step: 'sentry',
        error: (error as Error).message,
      });
      logger.error('Sentry\'yi kapatma hatası', { error: (error as Error).message });
    }

    // Zaman aşımını temizle
    clearTimeout(shutdownTimeout);

    const shutdownDuration = Date.now() - shutdownState.shutdownStartTime;
    logger.info(`Uygulama güvenli bir şekilde kapatıldı (${shutdownDuration}ms)`, {
      steps: shutdownState.shutdownSteps,
      errors: shutdownState.errors.length > 0 ? shutdownState.errors : undefined,
    });

    // Tüm logların yazılmasını bekle
    setTimeout(() => {
      process.exit(0);
    }, 500);
  } catch (error) {
    // Zaman aşımını temizle
    clearTimeout(shutdownTimeout);

    logger.error('Graceful shutdown sırasında hata', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    sentryHandler.sentryReportError(error as Error, { context: 'Graceful shutdown' });

    // Tüm logların yazılmasını bekle
    setTimeout(() => {
      process.exit(1);
    }, 500);
  }
}

// Sinyal işleyicileri
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Not: uncaughtException ve unhandledRejection olayları artık errorReporter.ts içinde işleniyor
// Buradaki işleyiciler sadece gracefulShutdown'u çağırmak için
process.on('uncaughtException', (error) => {
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  gracefulShutdown('unhandledRejection');
});

export default app;
