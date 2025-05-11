/**
 * src/__tests__/setup.ts
 * Jest test kurulum dosyası
 */

// Jest zaman aşımını artır
jest.setTimeout(30000);

// Jest'in açık kalan bağlantıları kapatmasını sağla
jest.mock('mongoose', () => {
  const originalModule = jest.requireActual('mongoose');
  return {
    ...originalModule,
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      ...originalModule.connection,
      readyState: 1, // 1 = connected
      close: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      once: jest.fn(),
    },
  };
});

// Ortam değişkenlerini ayarla
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test-db';
process.env['REDIS_ENABLED'] = 'false'; // Redis'i test ortamında devre dışı bırak

// Global mock'lar
global.console = {
  ...console,
  // Testlerde gereksiz log'ları bastır
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global setup
beforeAll(() => {
  console.log('Global setup başlatılıyor...');

  // Test başlangıcında yapılacak işlemler
  jest.clearAllMocks();

  console.log('Global setup tamamlandı.');
});

// Global teardown
afterAll(async () => {
  console.log('Test teardown başlatılıyor...');

  // Test sonrası temizleme işlemleri
  jest.clearAllMocks();

  // Açık kalan bağlantıları kapat
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Zamanlanmış görevleri temizle
  const timers = setTimeout(() => {}, 0) as unknown as number;
  for (let i = 0; i < timers; i++) {
    clearTimeout(i);
  }

  // Socket.IO bağlantılarını kapat
  try {
    const io = require('socket.io');
    if (io && io.sockets && io.sockets.close) {
      io.sockets.close();
    }
  } catch (error) {
    console.log('Socket.IO bağlantıları kapatılamadı', error);
  }

  // Tüm açık bağlantıları kapat
  try {
    // HTTP sunucusunu kapat
    const app = require('../app').default;
    if (app && app.server && app.server.close) {
      app.server.close();
    }
  } catch (error) {
    console.log('HTTP sunucusu kapatılamadı', error);
  }

  // Tüm işlemlerin tamamlanması için bekle
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('Test teardown tamamlandı.');
});
