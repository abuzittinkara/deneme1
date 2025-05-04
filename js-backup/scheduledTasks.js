/**
 * modules/scheduler/scheduledTasks.js
 * Zamanlanmış görevler
 */
const cron = require('node-cron');
const { logger } = require('../../utils/logger');
const archiveManager = require('../archive/archiveManager');
const sessionManager = require('../session/sessionManager');
const { redisClient } = require('../../config/redis');

// Zamanlanmış görevler
const scheduledTasks = [];

/**
 * Zamanlanmış görevleri başlatır
 */
function startScheduledTasks() {
  // Eski oturumları temizle (her 30 dakikada bir)
  const cleanupSessionsTask = cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('Zamanlanmış görev başlatıldı: Eski oturumları temizle');
      const result = await sessionManager.cleanupExpiredSessions(120); // 2 saat inaktif
      logger.info('Eski oturumlar temizlendi', { count: result });
    } catch (error) {
      logger.error('Oturum temizleme görevi hatası', { error: error.message });
    }
  });
  
  // Eski mesajları arşivle (her gün gece yarısı)
  const archiveMessagesTask = cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Zamanlanmış görev başlatıldı: Eski mesajları arşivle');
      const result = await archiveManager.archiveOldMessages();
      logger.info('Eski mesajlar arşivlendi', { count: result.archivedCount });
    } catch (error) {
      logger.error('Mesaj arşivleme görevi hatası', { error: error.message });
    }
  });
  
  // Eski direkt mesajları arşivle (her gün saat 1'de)
  const archiveDirectMessagesTask = cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('Zamanlanmış görev başlatıldı: Eski direkt mesajları arşivle');
      const result = await archiveManager.archiveOldDirectMessages();
      logger.info('Eski direkt mesajlar arşivlendi', { count: result.archivedCount });
    } catch (error) {
      logger.error('Direkt mesaj arşivleme görevi hatası', { error: error.message });
    }
  });
  
  // Kullanılmayan dosyaları temizle (her hafta Pazar günü saat 2'de)
  const cleanupFilesTask = cron.schedule('0 2 * * 0', async () => {
    try {
      logger.info('Zamanlanmış görev başlatıldı: Kullanılmayan dosyaları temizle');
      const result = await archiveManager.cleanupUnusedFiles();
      logger.info('Kullanılmayan dosyalar temizlendi', { count: result.cleanedCount });
    } catch (error) {
      logger.error('Dosya temizleme görevi hatası', { error: error.message });
    }
  });
  
  // Redis önbelleğini temizle (her gün saat 3'te)
  const cleanupRedisTask = cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Zamanlanmış görev başlatıldı: Redis önbelleğini temizle');
      
      // Kullanılmayan anahtarları temizle
      const keys = await redisClient.keys('*:temp:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info('Geçici Redis anahtarları temizlendi', { count: keys.length });
      }
    } catch (error) {
      logger.error('Redis temizleme görevi hatası', { error: error.message });
    }
  });
  
  // Bellek kullanımını günlüğe kaydet (her saat)
  const logMemoryUsageTask = cron.schedule('0 * * * *', () => {
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
  });
  
  // Görevleri listeye ekle
  scheduledTasks.push(
    cleanupSessionsTask,
    archiveMessagesTask,
    archiveDirectMessagesTask,
    cleanupFilesTask,
    cleanupRedisTask,
    logMemoryUsageTask
  );
  
  logger.info('Zamanlanmış görevler başlatıldı', { taskCount: scheduledTasks.length });
}

/**
 * Zamanlanmış görevleri durdurur
 */
function stopScheduledTasks() {
  // Tüm görevleri durdur
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks.length = 0;
  
  logger.info('Zamanlanmış görevler durduruldu');
}

module.exports = {
  startScheduledTasks,
  stopScheduledTasks
};
