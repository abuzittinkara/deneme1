/**
 * routes/health.js
 * Sağlık kontrolü rotaları
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');
const os = require('os');
const { logger } = require('../utils/logger');

/**
 * Veritabanı bağlantısını kontrol eder
 * @returns {Promise<Object>} - Veritabanı durumu
 */
async function checkDatabaseConnection() {
  try {
    // Veritabanı bağlantısını kontrol et
    if (mongoose.connection.readyState !== 1) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Database connection is not established'
      };
    }
    
    // Ping komutu ile bağlantıyı test et
    await mongoose.connection.db.admin().ping();
    
    return {
      healthy: true,
      status: 'connected',
      version: mongoose.version
    };
  } catch (error) {
    logger.error('Database health check error', { error: error.message });
    
    return {
      healthy: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Redis bağlantısını kontrol eder
 * @returns {Promise<Object>} - Redis durumu
 */
async function checkRedisConnection() {
  try {
    // Redis bağlantısını kontrol et
    const pong = await redisClient.ping();
    
    if (pong !== 'PONG') {
      return {
        healthy: false,
        status: 'error',
        error: 'Redis ping failed'
      };
    }
    
    // Redis bilgilerini al
    const info = await redisClient.info();
    const version = info.match(/redis_version:(.*)/)?.[1]?.trim() || 'unknown';
    
    return {
      healthy: true,
      status: 'connected',
      version
    };
  } catch (error) {
    logger.error('Redis health check error', { error: error.message });
    
    return {
      healthy: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Disk alanını kontrol eder
 * @returns {Promise<Object>} - Disk durumu
 */
async function checkDiskSpace() {
  try {
    // Disk alanı kontrolü için bir kütüphane kullanılabilir
    // Burada basit bir kontrol yapıyoruz
    const totalSpace = os.totalmem();
    const freeSpace = os.freemem();
    const usedSpace = totalSpace - freeSpace;
    const usedPercentage = (usedSpace / totalSpace) * 100;
    
    return {
      healthy: usedPercentage < 90, // %90'dan az kullanım sağlıklı
      status: usedPercentage < 90 ? 'ok' : 'warning',
      usedPercentage: usedPercentage.toFixed(2),
      totalSpace: `${Math.round(totalSpace / 1024 / 1024 / 1024)} GB`,
      freeSpace: `${Math.round(freeSpace / 1024 / 1024 / 1024)} GB`
    };
  } catch (error) {
    logger.error('Disk space check error', { error: error.message });
    
    return {
      healthy: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Bellek kullanımını kontrol eder
 * @returns {Object} - Bellek durumu
 */
function checkMemoryUsage() {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usedPercentage = (usedMemory / totalMemory) * 100;
    
    return {
      healthy: usedPercentage < 90, // %90'dan az kullanım sağlıklı
      status: usedPercentage < 90 ? 'ok' : 'warning',
      usedPercentage: usedPercentage.toFixed(2),
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    };
  } catch (error) {
    logger.error('Memory usage check error', { error: error.message });
    
    return {
      healthy: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Sağlık kontrolü endpoint'i
 */
router.get('/health', async (req, res) => {
  try {
    // Veritabanı bağlantısını kontrol et
    const dbStatus = await checkDatabaseConnection();
    
    // Redis bağlantısını kontrol et
    const redisStatus = await checkRedisConnection();
    
    // Disk alanını kontrol et
    const diskStatus = await checkDiskSpace();
    
    // Bellek kullanımını kontrol et
    const memoryStatus = checkMemoryUsage();
    
    // Genel sağlık durumu
    const allHealthy = dbStatus.healthy && 
                       redisStatus.healthy && 
                       diskStatus.healthy &&
                       memoryStatus.healthy;
    
    const statusCode = allHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
        disk: diskStatus,
        memory: memoryStatus
      }
    });
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Hazırlık kontrolü endpoint'i
 */
router.get('/ready', (req, res) => {
  // Uygulama hazır mı kontrol et
  const isReady = req.app.get('isReady');
  
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
